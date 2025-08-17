// FILE: netlify/functions/initiate-payment.js

const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK
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

exports.handler = async (event) => {
  console.log('--- initiate-payment function invoked. ---');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { authorization } = event.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized: No token provided.' };
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Extract amount, phoneNumber, and email from the request body
    const { amount, phoneNumber, email } = JSON.parse(event.body);
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { statusCode: 400, body: 'Invalid amount.' };
    }

    // Get the app ID from the environment variable (or a default if not set)
    // This is used to construct the Firestore path for transactions.
    const appId = process.env.APP_ID || 'default-app-id';

    // Reference to the user's specific transaction document in Firestore
    // Path: artifacts/{appId}/users/{userId}/transactions/{transactionId}
    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc();
    const identifier = transactionRef.id; // Workup Pay's identifier for this transaction

    // Create an IPN lookup entry to link Workup Pay's identifier back to the user and transaction
    // Path: ipn_lookups/{identifier}
    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    await ipnLookupRef.set({
      userId: userId,
      transactionId: identifier,
      phoneNumber: phoneNumber, // Store phone number from frontend for IPN lookup
      email: email, // Store email from frontend for IPN lookup
    });

    const ipnUrl = `${process.env.YOUR_APP_URL}/.netlify/functions/handleWorkupPayIPN`;
    console.log(`Constructed IPN URL for Workup Pay: ${ipnUrl}`);

    const parameters = {
      public_key: process.env.WORKUP_PAY_PUBLIC_KEY,
      identifier: identifier,
      currency: 'PKR',
      amount: paymentAmount.toFixed(2),
      details: `Package activation for user ${userId}`,
      ipn_url: ipnUrl,
      success_url: `${process.env.YOUR_APP_URL}/transactions?status=success`,
      cancel_url: `${process.env.YOUR_APP_URL}/transactions?status=cancelled`,
      site_logo: `${process.env.YOUR_APP_URL}/logo.png`, // Ensure this URL is accessible
      checkout_theme: 'light',
      customer_name: decodedToken.name || decodedToken.email || 'SMM User', // Use name from token, fallback to email or generic
      customer_email: decodedToken.email || email, // Use email from token, fallback to provided email
      customer_phone: phoneNumber, // Pass the mandatory phone number from the frontend
    };

    // Record the pending transaction in the user's subcollection
    await transactionRef.set({
      userId: userId,
      amount: paymentAmount,
      status: 'pending',
      gateway: 'WorkupPay',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      phoneNumber: phoneNumber, // Store phone number in the transaction record
      email: email, // Store email in the transaction record
    });

    // Make the payment initiation request to Workup Pay
    const response = await axios.post('https://workuppay.co/payment/initiate', parameters);

    if (response.data.success === 'ok' && response.data.url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ paymentUrl: response.data.url }),
      };
    } else {
      // Update transaction status to failed if Workup Pay initiation fails
      await transactionRef.update({ status: 'failed', failureReason: response.data.message || 'Workup Pay initiation failed.' });
      return { statusCode: 500, body: JSON.stringify({ error: response.data.message || 'Failed to initiate payment.' }) };
    }
  } catch (error) {
    console.error('Error in initiate-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
    };
  }
};
