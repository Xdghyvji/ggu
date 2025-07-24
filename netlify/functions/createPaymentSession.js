const axios = require("axios");
const admin = require("firebase-admin");

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
    const { amount, userId, userEmail } = JSON.parse(event.body);

    if (!amount || !userId || !userEmail || amount < 10) {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid request data." }) };
    }

    // Get the PUBLIC key from Netlify's environment variables
    const publicKey = process.env.WORKUO_PAY_PUBLIC_KEY;
    if (!publicKey) {
        console.error("Workuo Pay PUBLIC key is not set in environment variables.");
        return { statusCode: 500, body: JSON.stringify({ message: "Payment processor not configured." }) };
    }

    const internalTransactionRef = db.collection("users").doc(userId).collection("transactions").doc();
    const transactionId = internalTransactionRef.id;

    // Prepare the payload EXACTLY as per Workup Pay documentation
    const workuoPayPayload = {
        public_key: publicKey,
        identifier: transactionId, // Use our unique Firestore ID as the identifier
        currency: "PKR",
        amount: amount,
        details: `SMM Panel fund request for ${userEmail}`,
        ipn_url: `https://arhamshop.site/.netlify/functions/paymentWebhook`,
        success_url: `https://arhamshop.site/transactions`,
        cancel_url: `https://arhamshop.site/addFunds`,
        site_logo: 'https://arhamshop.site/logo.png', // Make sure you have a logo at this URL
        checkout_theme: 'light',
        customer_name: userData.name || userEmail.split('@')[0],
        customer_email: userEmail,
    };

    // Use the correct LIVE endpoint from the documentation
    const response = await axios.post("https://workuppay.co/payment/initiate", workuoPayPayload);

    if (response.data && response.data.url) {
      await internalTransactionRef.set({
        amount: amount,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        gateway: "Workuo Pay",
        gatewayTransactionId: null, // We will get this in the webhook
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ paymentUrl: response.data.url }),
      };
    } else {
      throw new Error(response.data.message || "Invalid response from payment gateway.");
    }
  } catch (error) {
    console.error("Error creating payment session:", error.response ? error.response.data : error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Could not initiate payment. Please try again later." }),
    };
  }
};
