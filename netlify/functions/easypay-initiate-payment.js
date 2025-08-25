// FILE: netlify/functions/easypay-initiate-payment.js

const admin = require('firebase-admin');
const crypto = require('crypto');
const querystring = require('querystring');

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

// Easypay Configuration from Environment Variables
const EASYPAY_STORE_ID = process.env.EASYPAY_STORE_ID;
const EASYPAY_HASH_KEY = process.env.EASYPAY_HASH_KEY;
const EASYPAY_PLUGIN_INDEX_URL = process.env.EASYPAY_PLUGIN_INDEX_URL || 'https://easypay.easypaisa.com.pk/easypay/Index.jsf';
const YOUR_APP_URL = process.env.YOUR_APP_URL; // Your Netlify deployed URL

// AES Encryption function as per Easypay guide (Page 21)
function encryptAES(text, key) {
  try {
    const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null); // AES/ECB/PKCS5Padding implies 128-bit key
    cipher.setAutoPadding(true); // PKCS5Padding is default for Node.js AES
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  } catch (error) {
    console.error("AES Encryption Error:", error);
    throw new Error("Failed to encrypt data.");
  }
}

exports.handler = async (event) => {
  console.log('--- easypay-initiate-payment function invoked. ---');

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

    const { amount, phoneNumber, email } = JSON.parse(event.body);
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { statusCode: 400, body: 'Invalid amount.' };
    }
    if (!phoneNumber) {
      return { statusCode: 400, body: 'Mobile number is required.' };
    }

    const appId = process.env.APP_ID || 'default-app-id';

    // Generate a unique order reference number
    const orderRefNum = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Define callback URLs for Easypay
    // MODIFICATION: Embed orderRefNum into the first postBackURL
    const postBackURL1 = `${YOUR_APP_URL}/.netlify/functions/easypay-callback-1?orderRefNum=${orderRefNum}`;
    const postBackURL2 = `${YOUR_APP_URL}/.netlify/functions/easypay-ipn-handler`;

    // Prepare parameters for Easypay (as per Page 8-9 of the guide)
    const easypayParams = {
      amount: paymentAmount.toFixed(2), // Amount must be in 2 decimal points
      storeId: EASYPAY_STORE_ID,
      postBackURL: postBackURL1, // First callback URL (now includes orderRefNum)
      orderRefNum: orderRefNum, // Still send as a separate param to Easypay
      autoRedirect: '0', // 0 = merchant redirects to final post back URL, 1 = Easypay redirects
      paymentMethod: 'MA_PAYMENT_METHOD', // Assuming Mobile Account payment for now
      emailAddr: email || decodedToken.email,
      mobileNum: phoneNumber,
      // expiryDate: 'YYYYMMDD HHMMSS', // Optional, can add if needed
    };

    // Construct the string for merchantHashedReq (Page 21, Step 4)
    // Note: Easypay guide says "amount=10.0&autoRedirect=0...", implying URL-encoded format
    const fieldsToHash = { ...easypayParams }; // Copy params for hashing
    delete fieldsToHash.postBackURL; // postBackURL should NOT be part of the hash string as per Easypay sample
    delete fieldsToHash.autoRedirect; // autoRedirect should NOT be part of the hash string as per Easypay sample
    delete fieldsToHash.paymentMethod; // paymentMethod should NOT be part of the hash string as per Easypay sample
    delete fieldsToHash.emailAddr; // emailAddr should NOT be part of the hash string as per Easypay sample
    delete fieldsToHash.mobileNum; // mobileNum should NOT be part of the hash string as per Easypay sample

    const sortedFieldNames = Object.keys(fieldsToHash).sort();
    const hashString = sortedFieldNames.map(key => `${key}=${fieldsToHash[key]}`).join('&');

    let merchantHashedReq;
    if (EASYPAY_HASH_KEY) {
      merchantHashedReq = encryptAES(hashString, EASYPAY_HASH_KEY);
      easypayParams.merchantHashedReq = merchantHashedReq;
    }

    // Store pending transaction in Firestore
    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc(orderRefNum); // Use orderRefNum as doc ID
    await transactionRef.set({
      userId: userId,
      amount: paymentAmount,
      status: 'pending',
      gateway: 'Easypaisa',
      orderRefNum: orderRefNum,
      phoneNumber: phoneNumber,
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      easypayParams: easypayParams, // Store the params sent to Easypay
    });

    // Store IPN lookup for the second callback
    const ipnLookupRef = db.collection('ipn_lookups').doc(orderRefNum);
    await ipnLookupRef.set({
      userId: userId,
      transactionId: orderRefNum,
      phoneNumber: phoneNumber,
      email: email,
      postBackURL2: postBackURL2, // Store the second callback URL for the first callback to use
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Construct the final Easypay redirect URL
    const easypayRedirectUrl = `${EASYPAY_PLUGIN_INDEX_URL}?${querystring.encode(easypayParams)}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ paymentUrl: easypayRedirectUrl }),
    };

  } catch (error) {
    console.error('Error in easypay-initiate-payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'An internal error occurred during Easypay initiation.' }),
    };
  }
};
