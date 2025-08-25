// FILE: netlify/functions/easypay-ipn-handler.js

const admin = require('firebase-admin');

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
  console.log('--- easypay-ipn-handler function invoked. ---');

  // Easypay sends final status as GET parameters (Page 9, Step 2)
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { status, desc, orderRefNum } = event.queryStringParameters;

  if (!status || !orderRefNum) {
    console.error('Easypay IPN Handler Error: Missing status or orderRefNum.');
    return { statusCode: 400, body: 'Missing parameters from Easypay IPN.' };
  }

  try {
    const appId = process.env.APP_ID || 'default-app-id';

    // Find the IPN lookup to get userId and original transaction details
    const ipnLookupRef = db.collection('ipn_lookups').doc(orderRefNum);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
      console.error(`Easypay IPN Handler Error: IPN lookup not found for orderRefNum: ${orderRefNum}.`);
      return { statusCode: 404, body: 'Transaction lookup not found.' };
    }

    const { userId, phoneNumber, email } = ipnLookupDoc.data();
    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc(orderRefNum);

    await db.runTransaction(async (t) => {
      const transactionDoc = await t.get(transactionRef);

      if (!transactionDoc.exists) {
        console.error(`Easypay IPN Handler Error: Transaction document not found for orderRefNum: ${orderRefNum}.`);
        throw new Error('Transaction document not found.');
      }

      const currentStatus = transactionDoc.data().status;

      // Prevent double processing
      if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled') {
        console.log(`Easypay IPN for ${orderRefNum} already processed with status: ${currentStatus}. Skipping.`);
        return;
      }

      const newStatus = status.toLowerCase() === 'success' ? 'completed' : 'failed';

      t.update(transactionRef, {
        status: newStatus,
        gatewayResponseStatus: status,
        gatewayResponseDescription: desc,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: phoneNumber, // Ensure phone number is stored
        email: email, // Ensure email is stored
      });

      console.log(`Easypay IPN for order ${orderRefNum} updated to status: ${newStatus}`);
    });

    return { statusCode: 200, body: 'IPN processed successfully.' };

  } catch (error) {
    console.error('Error in easypay-ipn-handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred during Easypay IPN processing.' }),
    };
  }
};