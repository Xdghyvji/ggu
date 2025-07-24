// FILE: netlify/functions/createPaymentSession.js

const admin = require('firebase-admin');
const axios = require('axios');

// --- UPDATED FIREBASE INITIALIZATION ---
// This now uses individual environment variables to avoid the 4KB limit.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Authenticate the user
    const { authorization } = event.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized: No token provided.' };
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    // Get amount from the request body
    const { amount } = JSON.parse(event.body);
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { statusCode: 400, body: 'Invalid amount.' };
    }

    // Create a unique identifier for this transaction
    const transactionRef = db.collection('users').doc(userId).collection('transactions').doc();
    const identifier = transactionRef.id;

    const parameters = {
      public_key: process.env.WORKUP_PAY_PUBLIC_KEY,
      identifier: identifier,
      currency: 'PKR',
      amount: paymentAmount.toFixed(2),
      details: `Fund deposit for user ${userId}`,
      ipn_url: `${process.env.YOUR_APP_URL}/.netlify/functions/handleWorkupPayIPN`,
      // --- FIX: Use the environment variable for the success URL ---
      success_url: `${process.env.YOUR_APP_URL}/transactions?status=success`,
      cancel_url: `${process.env.YOUR_APP_URL}/transactions?status=cancelled`,
      site_logo: `${process.env.YOUR_APP_URL}/logo.png`,
      checkout_theme: 'light',
      customer_name: decodedToken.name || 'SMM User',
      customer_email: userEmail,
    };

    // Create the pending transaction document
    await transactionRef.set({
      userId: userId,
      amount: paymentAmount,
      status: 'pending',
      gateway: 'WorkupPay',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Call Workup Pay API
    const response = await axios.post('https://workuppay.co/payment/initiate', parameters);

    if (response.data.success === 'ok' && response.data.url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ paymentUrl: response.data.url }),
      };
    } else {
      await transactionRef.update({ status: 'failed', failureReason: response.data.message });
      return { statusCode: 500, body: JSON.stringify({ error: response.data.message || 'Failed to initiate payment.' }) };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.code === 'auth/id-token-expired' ? 401 : 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
    };
  }
};

// ========================================================================

// FILE: netlify/functions/handleWorkupPayIPN.js

const admin = require('firebase-admin');
const crypto = require('crypto');

// --- UPDATED FIREBASE INITIALIZATION ---
// This now uses individual environment variables to avoid the 4KB limit.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // --- FIX: Parse URL-encoded form data instead of JSON ---
  const params = new URLSearchParams(event.body);
  const status = params.get('status');
  const signature = params.get('signature');
  const identifier = params.get('identifier');
  const rawData = params.get('data'); // This will be a JSON string inside the form data
  const data = JSON.parse(rawData);   // Parse the nested JSON data

  // --- Signature Validation ---
  const customKey = `${data.amount}${identifier}`;
  const mySignature = crypto
    .createHmac('sha256', process.env.WORKUP_PAY_SECRET_KEY)
    .update(customKey)
    .digest('hex')
    .toUpperCase();

  if (signature !== mySignature) {
    console.error('IPN Validation Failed: Signatures do not match.');
    return { statusCode: 400, body: 'Invalid signature.' };
  }
  
  // --- Find user and transaction ---
  const usersSnapshot = await db.collection('users').get();
  let userId = null;
  for (const userDoc of usersSnapshot.docs) {
    const transactionDoc = await db.collection('users').doc(userDoc.id).collection('transactions').doc(identifier).get();
    if (transactionDoc.exists) {
      userId = userDoc.id;
      break;
    }
  }

  if (!userId) {
     console.error(`IPN Error: Could not find transaction for identifier: ${identifier}`);
     return { statusCode: 404, body: 'Transaction not found.' };
  }

  const userRef = db.collection("users").doc(userId);
  const transactionRef = userRef.collection("transactions").doc(identifier);
    
  try {
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const transactionDoc = await t.get(transactionRef);
      
      if (!userDoc.exists() || !transactionDoc.exists()) {
        throw new Error("User or Transaction document not found.");
      }
      
      if (transactionDoc.data().status === 'completed') {
          console.log(`IPN for ${identifier} already processed.`);
          return;
      }
      
      if (status === "success") {
        const amountToAdd = parseFloat(data.amount);
        const newBalance = (userDoc.data().balance || 0) + amountToAdd;
        t.update(userRef, { balance: newBalance });
        t.update(transactionRef, {
            status: 'completed',
            gatewayTransactionId: data.trx,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // --- Handle referral commission logic ---
        const userData = userDoc.data();
        if (userData.referredBy) {
            const referrerRef = db.collection("users").doc(userData.referredBy);
            const commissionRate = 0.05; // 5%
            const commissionAmount = amountToAdd * commissionRate;

            const referrerDoc = await t.get(referrerRef);
            if (referrerDoc.exists()) {
                 const currentCommission = referrerDoc.data().commissionBalance || 0;
                 t.update(referrerRef, { commissionBalance: currentCommission + commissionAmount });

                 const commissionLogRef = db.collection("users").doc(userData.referredBy).collection("commissions").doc();
                 t.set(commissionLogRef, {
                    amount: commissionAmount,
                    fromUserId: userId,
                    fromUserEmail: userData.email,
                    transactionId: identifier,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                 });

                 console.log(`Awarded ${commissionAmount} commission to referrer ${userData.referredBy}`);
            }
        }
      } else {
        t.update(transactionRef, { status: 'failed' });
      }
    });
    
    return { statusCode: 200, body: 'IPN Processed' };

  } catch (error) {
    console.error('IPN Transaction failed:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
