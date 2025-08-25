// FILE: netlify/functions/easypay-initiate-payment.js (SOAP)

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
const EASYPAY_STORE_ID = process.env.EASYPAY_STORE_ID;
const EASYPAY_API_USERNAME = process.env.EASYPAY_API_USERNAME; // DigitalWorkup
const EASYPAY_API_PASSWORD = process.env.EASYPAY_API_PASSWORD; // 418ac87c31971a9c21da9d3ceb09f3a6
const EASYPAY_SOAP_WSDL_URL = process.env.EASYPAY_SOAP_WSDL_URL || 'https://easypay.easypaisa.com.pk/easypay-service/PartnerBusinessService/META-INF/wsdl/partner/transaction/PartnerBusinessService.wsdl';

const YOUR_APP_URL = process.env.YOUR_APP_URL;

exports.handler = async (event) => {
  console.log('--- easypay-initiate-payment (SOAP) function invoked. ---');

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

    const { amount, phoneNumber, email, paymentType } = JSON.parse(event.body);
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { statusCode: 400, body: 'Invalid amount.' };
    }
    if (!phoneNumber) {
      return { statusCode: 400, body: 'Mobile number is required.' };
    }

    const appId = process.env.APP_ID || 'default-app-id';

    // Generate a unique order reference number
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create SOAP client
    const client = await soap.createClientAsync(EASYPAY_SOAP_WSDL_URL);
    console.log('SOAP client created.');

    // Temporarily log the client's last request for debugging
    client.on('request', function (xml) {
        console.log('SOAP Request XML:', xml);
    });
    client.on('response', function (xml) {
        console.log('SOAP Response XML (raw):', xml);
    });
    client.on('fault', function (fault) {
        console.error('SOAP Fault:', fault);
    });

    // Prepare SOAP request parameters for initiateTransaction (Page 13 of guide)
    const soapArgs = {
      username: EASYPAY_API_USERNAME,
      password: EASYPAY_API_PASSWORD,
      channel: 'Internet', // As per guide sample
      orderId: orderId,
      storeId: parseInt(EASYPAY_STORE_ID), // Store ID is Integer
      transactionAmount: paymentAmount.toFixed(2), // SOAP API expects 2 decimal points
      transactionType: 'MA', // Mobile Account transaction
      msisdn: phoneNumber, // Customer's MSISDN
      mobileAccountNo: phoneNumber, // Customer's Mobile Account # (often same as MSISDN for MA)
      emailAddress: email || decodedToken.email,
    };

    console.log('Initiating Easypay SOAP transaction with args:', soapArgs);
    const result = await client.initiateTransactionAsync(soapArgs);
    
    // --- FIX START ---
    // Access the response directly from the result object, often under the method name
    // Based on the raw XML, it should be result[0].initiateTransactionResponseType
    // However, node-soap often unwraps it further. Let's try direct access first.
    let response;
    if (result && result[0] && result[0].initiateTransactionResponseType) {
        response = result[0].initiateTransactionResponseType;
    } else if (result && result.initiateTransactionResponse && result.initiateTransactionResponse.initiateTransactionResponseType) {
        // Alternative path if node-soap wraps it differently
        response = result.initiateTransactionResponse.initiateTransactionResponseType;
    } else {
        // Fallback or error if expected structure isn't found
        console.error('Unexpected SOAP response structure:', JSON.stringify(result));
        throw new Error('Unexpected SOAP response structure from Easypay.');
    }
    // --- FIX END ---

    console.log('Easypay SOAP initiateTransaction response:', response);

    // Now check response.responseCode
    if (response.responseCode === '0000') { // Success
      const transactionRef = db.collection('artifacts').doc(appId)
                               .collection('users').doc(userId)
                               .collection('transactions').doc(orderId); // Use orderId as doc ID
      await transactionRef.set({
        userId: userId,
        amount: paymentAmount,
        status: 'pending', // Initial status is pending, will be confirmed by inquireTransaction or IPN
        gateway: 'Easypaisa_SOAP', // Indicate SOAP gateway
        orderRefNum: orderId,
        gatewayTransactionId: response.transactionId, // Easypay's internal transaction ID
        phoneNumber: phoneNumber,
        email: email,
        paymentType: paymentType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        easypaySoapResponse: response, // Store full SOAP response for debugging
      });

      // For SOAP, there's no redirect to Easypay's page. The transaction is initiated server-side.
      // We return a success message and the orderId for the frontend to potentially poll.
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Easypay transaction initiated successfully.',
          orderId: orderId,
          transactionId: response.transactionId,
          status: 'initiated', // Custom status for frontend
          // No paymentUrl as there is no redirection
        }),
      };
    } else {
      // Easypay API returned an error code (e.g., 0010)
      const transactionRef = db.collection('artifacts').doc(appId)
                               .collection('users').doc(userId)
                               .collection('transactions').doc(orderId);
      await transactionRef.set({
        userId: userId,
        amount: paymentAmount,
        status: 'failed',
        gateway: 'Easypaisa_SOAP', // Indicate SOAP gateway
        orderRefNum: orderId,
        phoneNumber: phoneNumber,
        email: email,
        paymentType: paymentType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        easypaySoapResponse: response,
        failureReason: `Easypay API Error: ${response.responseCode} - ${response.responseDescription || 'Unknown error'}`,
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Easypay API Error: ${response.responseCode} - ${response.responseDescription || 'Unknown error'}`,
        }),
      };
    }

  } catch (error) {
    console.error('Error in easypay-initiate-payment (SOAP):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred during Easypay SOAP initiation.' }),
    };
  }
};
