// FILE: netlify/functions/easypay-inquire-transaction.js (SOAP)

const admin = require('firebase-admin');
const soap = require('soap'); // NEW: SOAP client library

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

// Easypay Configuration from Environment Variables for SOAP
const EASYPAY_API_USERNAME = process.env.EASYPAY_API_USERNAME;
const EASYPAY_API_PASSWORD = process.env.EASYPAY_API_PASSWORD;
const EASYPAY_SOAP_WSDL_URL = process.env.EASYPAY_SOAP_WSDL_URL || 'https://easypay.easypaisa.com.pk/easypay-service/PartnerBusinessService/META-INF/wsdl/partner/transaction/PartnerBusinessService.wsdl';
const EASYPAY_ACCOUNT_ID = process.env.EASYPAY_ACCOUNT_ID; // Merchant Account # registered with Easypay (used for inquireTransaction)

exports.handler = async (event) => {
  console.log('--- easypay-inquire-transaction (SOAP) function invoked. ---');

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

    const { orderId } = JSON.parse(event.body);

    if (!orderId) {
      return { statusCode: 400, body: 'Order ID is required to inquire transaction status.' };
    }

    // Create SOAP client
    const client = await soap.createClientAsync(EASYPAY_SOAP_WSDL_URL);
    console.log('SOAP client created for inquireTransaction.');

    // Prepare SOAP request parameters for inquireTransaction (Page 15 of guide)
    const soapArgs = {
      username: EASYPAY_API_USERNAME,
      password: EASYPAY_API_PASSWORD,
      orderId: orderId,
      accountNum: EASYPAY_ACCOUNT_ID, // Merchant Account # registered with Easypay
    };

    console.log('Inquiring Easypay SOAP transaction status for orderId:', orderId);
    const result = await client.inquireTransactionAsync(soapArgs);
    const response = result[0].inquireTransactionResponseType; // Access the actual response

    console.log('Easypay SOAP inquireTransaction response:', response);

    const appId = process.env.APP_ID || 'default-app-id';
    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc(orderId);

    // Determine new status based on Easypay's response
    let newStatus = 'pending';
    if (response.responseCode === '0000' && response.transactionStatus === 'PAID') {
      newStatus = 'completed';
    } else if (response.responseCode === '0000' && (response.transactionStatus === 'REVERSED' || response.transactionStatus === 'FAILED')) {
        newStatus = 'failed';
    } else if (response.responseCode !== '0000') {
        newStatus = 'failed'; // API error
    }

    // Retrieve original transaction to get amount and paymentType for balance update
    const originalTransactionDoc = await transactionRef.get();
    const originalTransactionData = originalTransactionDoc.data();
    const currentBalance = (await db.collection("artifacts").doc(appId).collection("users").doc(userId).get()).data().balance || 0;

    await db.runTransaction(async (t) => {
        const latestTransactionDoc = await t.get(transactionRef);
        const latestTransactionData = latestTransactionDoc.data();

        // Prevent double processing and ensure status change
        // Only update if current status is pending and new status is not pending
        if (latestTransactionData.status === 'pending' && newStatus !== 'pending') {
            t.update(transactionRef, {
                status: newStatus,
                gatewayResponseStatus: response.transactionStatus, // Easypay's specific status
                gatewayResponseDescription: response.responseCode === '0000' ? 'Success' : response.responseCode,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                easypayInquireResponse: response, // Store full SOAP inquire response
            });

            // If it's a fund deposit and completed, update user balance
            if (newStatus === 'completed' && originalTransactionData.paymentType === 'fund_deposit') {
                const amountToAdd = originalTransactionData.amount;
                const updatedBalance = currentBalance + amountToAdd;
                t.update(db.collection("artifacts").doc(appId).collection("users").doc(userId), { balance: updatedBalance });
                console.log(`User ${userId} balance updated to ${updatedBalance} for fund deposit via Easypay SOAP.`);
            }
        }
    });


    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: orderId,
        transactionStatus: response.transactionStatus, // Easypay's status (PAID, REVERSED, etc.)
        responseCode: response.responseCode,
        newAppStatus: newStatus, // Our app's derived status (completed, failed, pending)
      }),
    };

  } catch (error) {
    console.error('Error in easypay-inquire-transaction (SOAP):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred during Easypay SOAP inquiry.' }),
    };
  }
};
