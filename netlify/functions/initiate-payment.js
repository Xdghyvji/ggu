// FILE: netlify/functions/initiate-payment.js (for Workup Pay)

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
  console.log('--- initiate-payment (Workup Pay) function invoked. ---');

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

    // Extract amount, phoneNumber, email, and paymentType from the request body
    const { amount, phoneNumber, email, paymentType } = JSON.parse(event.body);
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { statusCode: 400, body: 'Invalid amount.' };
    }
    if (!phoneNumber) {
      return { statusCode: 400, body: 'Mobile number is required.' };
    }

    const appId = process.env.APP_ID || 'default-app-id';

    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc();
    const identifier = transactionRef.id;

    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    await ipnLookupRef.set({
      userId: userId,
      transactionId: identifier,
      phoneNumber: phoneNumber,
      email: email,
      paymentType: paymentType, // Store payment type for IPN handler
      gateway: 'WorkupPay',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const ipnUrl = `${process.env.YOUR_APP_URL}/.netlify/functions/handleWorkupPayIPN`;
    console.log(`Constructed IPN URL for Workup Pay: ${ipnUrl}`);

    const details = paymentType === 'fund_deposit' ? `Fund deposit for user ${userId}` : `Package activation for user ${userId}`;

    const parameters = {
      public_key: process.env.WORKUP_PAY_PUBLIC_KEY,
      identifier: identifier,
      currency: 'PKR',
      amount: paymentAmount.toFixed(2),
      details: details,
      ipn_url: ipnUrl,
      success_url: `${process.env.YOUR_APP_URL}/transactions?status=success&gateway=workuppay&orderRefNum=${identifier}`,
      cancel_url: `${process.env.YOUR_APP_URL}/transactions?status=cancelled&gateway=workuppay&orderRefNum=${identifier}`,
      site_logo: `${process.env.YOUR_APP_URL}/logo.png`,
      checkout_theme: 'light',
      customer_name: decodedToken.name || decodedToken.email || 'SMM User',
      customer_email: decodedToken.email || email,
      customer_phone: phoneNumber,
    };

    await transactionRef.set({
      userId: userId,
      amount: paymentAmount,
      status: 'pending',
      gateway: 'WorkupPay',
      orderRefNum: identifier, // Use identifier as orderRefNum for consistency
      phoneNumber: phoneNumber,
      email: email,
      paymentType: paymentType, // Store payment type in transaction
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = await axios.post('https://workuppay.co/payment/initiate', parameters);

    if (response.data.success === 'ok' && response.data.url) {
      return {
        statusCode: 200,
        body: JSON.stringify({ paymentUrl: response.data.url }),
      };
    } else {
      await transactionRef.update({ status: 'failed', failureReason: response.data.message || 'Failed to initiate payment.' });
      return { statusCode: 500, body: JSON.stringify({ error: response.data.message || 'Failed to initiate payment.' }) };
    }
  } catch (error) {
    console.error('Error in initiate-payment (Workup Pay):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
    };
  }
};