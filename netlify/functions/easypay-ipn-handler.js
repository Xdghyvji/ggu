// FILE: netlify/functions/easypay-ipn-handler.js (SOAP - Passive IPN)

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
  console.log('--- easypay-ipn-handler (SOAP) function invoked. ---');

  // Easypay might send IPNs for SOAP transactions, but the format is not explicitly detailed in Open API section.
  // Assuming it might still be GET parameters or a POST with a body.
  // For now, we'll keep it expecting GET, but be aware this might need adjustment.

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') { // Allow both GET and POST for IPN
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let params;
  if (event.httpMethod === 'GET') {
      params = event.queryStringParameters;
  } else { // Assume POST with form-urlencoded or JSON
      try {
          params = JSON.parse(event.body); // Try JSON
      } catch (e) {
          params = new URLSearchParams(event.body); // Fallback to form-urlencoded
          // Convert URLSearchParams to a plain object
          const objParams = {};
          for (const [key, value] of params.entries()) {
              objParams[key] = value;
          }
          params = objParams;
      }
  }

  const { status, desc, orderRefNum, transactionId: gatewayTransactionId } = params; // Easypay might send transactionId directly

  if (!orderRefNum) {
    console.error('Easypay IPN Handler Error: Missing orderRefNum in IPN.');
    return { statusCode: 400, body: 'Missing orderRefNum from Easypay IPN.' };
  }

  try {
    const appId = process.env.APP_ID || 'default-app-id';

    const ipnLookupRef = db.collection('ipn_lookups').doc(orderRefNum);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
      console.warn(`Easypay IPN Handler Warning: IPN lookup not found for orderRefNum: ${orderRefNum}. Transaction might have been initiated via other means or already processed.`);
      return { statusCode: 200, body: 'IPN received, but lookup not found (already processed or unknown).' }; // Respond 200 to Easypay
    }

    const { userId, paymentType, phoneNumber, email } = ipnLookupDoc.data();
    const userRef = db.collection("artifacts").doc(appId).collection("users").doc(userId);
    const transactionRef = userRef.collection("transactions").doc(orderRefNum);

    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const transactionDoc = await t.get(transactionRef);

      if (!userDoc.exists || !transactionDoc.exists) {
        console.error(`Easypay IPN Handler Error: User (${userId}) or Transaction (${orderRefNum}) document not found during transaction.`);
        throw new Error('User or Transaction document not found.');
      }

      const currentStatus = transactionDoc.data().status;
      const currentBalance = userDoc.data().balance || 0;

      if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled') {
        console.log(`Easypay IPN for ${orderRefNum} already processed with status: ${currentStatus}. Skipping.`);
        return;
      }

      // Determine new status based on IPN. Easypay's SOAP inquireTransaction returns "PAID".
      // Assuming IPN status might also be "PAID" or "SUCCESS".
      const newStatus = (status && status.toLowerCase() === 'paid') || (status && status.toLowerCase() === 'success') ? 'completed' : 'failed';

      if (newStatus === 'completed' && paymentType === 'fund_deposit') {
        const amountToAdd = transactionDoc.data().amount; // Get original amount from transaction
        const newBalance = currentBalance + amountToAdd;
        t.update(userRef, { balance: newBalance }); // Update user's main balance
        console.log(`User ${userId} balance updated to ${newBalance} for fund deposit via Easypay SOAP IPN.`);
      }

      t.update(transactionRef, {
        status: newStatus,
        gatewayResponseStatus: status || 'N/A',
        gatewayResponseDescription: desc || 'N/A',
        gatewayTransactionId: gatewayTransactionId || transactionDoc.data().gatewayTransactionId || 'N/A', // Use IPN's transactionId if available
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        phoneNumber: phoneNumber,
        email: email,
        paymentType: paymentType,
        easypayIpnRaw: params, // Store raw IPN for debugging
      });

      console.log(`Easypay IPN for order ${orderRefNum} updated to status: ${newStatus}`);
    });

    return { statusCode: 200, body: 'IPN processed successfully.' };

  } catch (error) {
    console.error('Error in easypay-ipn-handler (SOAP):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred during Easypay IPN processing.' }),
    };
  }
};
