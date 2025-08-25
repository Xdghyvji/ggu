// FILE: netlify/functions/easypay-initiate-payment.js (for Easypay)

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

const EASYPAY_STORE_ID = process.env.EASYPAY_STORE_ID;
const EASYPAY_HASH_KEY = process.env.EASYPAY_HASH_KEY;
const EASYPAY_PLUGIN_INDEX_URL = process.env.EASYPAY_PLUGIN_INDEX_URL || 'https://easypay.easypaisa.com.pk/easypay/Index.jsf';
const YOUR_APP_URL = process.env.YOUR_APP_URL;

function encryptAES(text, key) {
  try {
    let encryptionKey = Buffer.from(key, 'utf8');
    if (encryptionKey.length !== 16) {
        encryptionKey = crypto.createHash('sha256').update(key).digest().slice(0, 16);
        console.warn("EASYPAY_HASH_KEY length adjusted to 16 bytes for AES-128-ECB. Original key length was:", Buffer.from(key, 'utf8').length);
    }

    const cipher = crypto.createCipheriv('aes-128-ecb', encryptionKey, null);
    cipher.setAutoPadding(true);
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

    const orderRefNum = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const postBackURL1 = `${YOUR_APP_URL}/.netlify/functions/easypay-callback-1?orderRefNum=${orderRefNum}`;
    const postBackURL2 = `${YOUR_APP_URL}/.netlify/functions/easypay-ipn-handler`;

    const easypayParams = {
      amount: paymentAmount.toFixed(2),
      storeId: EASYPAY_STORE_ID,
      postBackURL: postBackURL1,
      orderRefNum: orderRefNum,
      autoRedirect: '0',
      paymentMethod: 'MA_PAYMENT_METHOD',
      emailAddr: email || decodedToken.email,
      mobileNum: phoneNumber,
    };

    const fieldsToHash = {
      amount: paymentAmount.toFixed(1),
      storeId: easypayParams.storeId,
      postBackURL: easypayParams.postBackURL,
      orderRefNum: easypayParams.orderRefNum,
      autoRedirect: easypayParams.autoRedirect,
    };

    const sortedFieldNames = Object.keys(fieldsToHash).sort();
    const hashString = sortedFieldNames.map(key => `${key}=${fieldsToHash[key]}`).join('&');

    console.log("Hash String generated:", hashString);

    let merchantHashedReq;
    if (EASYPAY_HASH_KEY) {
      merchantHashedReq = encryptAES(hashString, EASYPAY_HASH_KEY);
      easypayParams.merchantHashedReq = merchantHashedReq;
      console.log("Encrypted merchantHashedReq:", merchantHashedReq);
    }

    const transactionRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('transactions').doc(orderRefNum);
    await transactionRef.set({
      userId: userId,
      amount: paymentAmount,
      status: 'pending',
      gateway: 'Easypaisa',
      orderRefNum: orderRefNum,
      phoneNumber: phoneNumber,
      email: email,
      paymentType: paymentType, // Store payment type in transaction
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      easypayParams: easypayParams,
      hashStringDebug: hashString,
    });

    const ipnLookupRef = db.collection('ipn_lookups').doc(orderRefNum);
    await ipnLookupRef.set({
      userId: userId,
      transactionId: orderRefNum,
      phoneNumber: phoneNumber,
      email: email,
      paymentType: paymentType, // Store payment type for IPN handler
      gateway: 'Easypaisa',
      postBackURL2: postBackURL2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const easypayRedirectUrl = `${EASYPAY_PLUGIN_INDEX_URL}?${querystring.encode(easypayParams)}`;
    console.log("Redirecting to Easypay URL:", easypayRedirectUrl);

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