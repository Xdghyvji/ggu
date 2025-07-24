// FILE: netlify/functions/createPaymentSession.js

const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK - This block should only appear once per file.
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

    // --- FIX: Create a lookup document for the IPN handler ---
    // This allows the IPN function to find the user without searching the entire database.
    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    await ipnLookupRef.set({ userId: userId });

    const parameters = {
      public_key: process.env.WORKUP_PAY_PUBLIC_KEY,
      identifier: identifier,
      currency: 'PKR',
      amount: paymentAmount.toFixed(2),
      details: `Fund deposit for user ${userId}`,
      ipn_url: `${process.env.YOUR_APP_URL}/.netlify/functions/handleWorkupPayIPN`,
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
