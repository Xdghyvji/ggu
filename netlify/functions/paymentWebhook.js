const admin = require("firebase-admin");
const crypto = require("crypto");

// Securely load the Firebase service account key from environment variables
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Workup Pay sends data as form-urlencoded, so we need to parse it.
    const fields = new URLSearchParams(event.body);
    const status = fields.get('status');
    const signature = fields.get('signature');
    const identifier = fields.get('identifier');
    const data = JSON.parse(fields.get('data')); // Data is a JSON string

    if (!status || !signature || !identifier || !data) {
      console.error("Webhook Error: Missing parameters.");
      return { statusCode: 400, body: "Invalid webhook payload." };
    }

    // --- SIGNATURE VERIFICATION ---
    const secretKey = process.env.WORKUO_PAY_SECRET_KEY;
    if (!secretKey) {
        console.error("Webhook Error: Secret key not configured.");
        return { statusCode: 500, body: "Configuration error." };
    }
    
    const customKey = `${data.amount}${identifier}`;
    const mySignature = crypto.createHmac('sha256', secretKey).update(customKey).digest('hex').toUpperCase();

    if (mySignature !== signature) {
        console.error("Webhook Error: Invalid signature.");
        return { statusCode: 401, body: "Invalid signature." };
    }
    // --- END SIGNATURE VERIFICATION ---

    const querySnapshot = await db.collectionGroup("transactions").where(admin.firestore.FieldPath.documentId(), "==", identifier).limit(1).get();

    if (querySnapshot.empty) {
        console.error(`Webhook Error: Transaction with identifier ${identifier} not found.`);
        return { statusCode: 404, body: "Transaction not found." };
    }

    const transactionDoc = querySnapshot.docs[0];
    const transactionRef = transactionDoc.ref;
    const transactionData = transactionDoc.data();
    const userId = transactionRef.parent.parent.id;
    const userRef = db.collection("users").doc(userId);

    if (transactionData.status !== 'pending') {
        return { statusCode: 200, body: "Transaction already processed." };
    }

    if (status === "success") {
        const amount = transactionData.amount;
        
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const newBalance = (userDoc.data().balance || 0) + amount;
            t.update(userRef, { balance: newBalance });
            t.update(transactionRef, { 
                status: "completed",
                gatewayTransactionId: data.transaction_id 
            });
        });
    } else {
        await transactionRef.update({ 
            status: "failed",
            gatewayTransactionId: data.transaction_id 
        });
    }

    return { statusCode: 200, body: "Webhook received successfully." };

  } catch (error) {
    console.error("Webhook processing error:", error);
    return { statusCode: 500, body: "Internal server error." };
  }
};
