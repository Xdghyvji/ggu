// FILE: netlify/functions/easypay-initiate-payment.js

const admin = require('firebase-admin');
const crypto = require('crypto');
const querystring = require('querystring'); // For URL encoding parameters

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
    // Easypay guide implies AES/ECB/PKCS5Padding with a 128-bit key.
    // Node.js crypto.createCipheriv expects key as Buffer and IV (initialization vector) for CBC/CFB modes.
    // For ECB, IV is not used. Key length for AES-128 is 16 bytes.
    // Ensure EASYPAY_HASH_KEY is 16 characters long if it's directly used as the key.
    // If it's a passphrase, a KDF (Key Derivation Function) like PBKDF2 would be needed.
    // Assuming EASYPAY_HASH_KEY is the raw 16-byte key.
    
    // If the key is not exactly 16 bytes, it will cause an error.
    // For now, let's ensure the key buffer is 16 bytes.
    let encryptionKey = Buffer.from(key, 'utf8');
    if (encryptionKey.length !== 16) {
        // Pad or truncate key to 16 bytes (128 bits) if necessary.
        // This is a common workaround if the provided key isn't exactly 16 bytes.
        // A more robust solution would be to generate a proper key from a passphrase.
        encryptionKey = crypto.createHash('sha256').update(key).digest().slice(0, 16);
        console.warn("EASYPAY_HASH_KEY length adjusted to 16 bytes for AES-128-ECB.");
    }

    const cipher = crypto.createCipheriv('aes-128-ecb', encryptionKey, null);
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
    const postBackURL1 = `${YOUR_APP_URL}/.netlify/functions/easypay-callback-1?orderRefNum=${orderRefNum}`;
    const postBackURL2 = `${YOUR_APP_URL}/.netlify/functions/easypay-ipn-handler`;

    // Prepare parameters for Easypay (as per Page 8-9 of the guide)
    const easypayParams = {
      amount: paymentAmount.toFixed(2), // Amount must be in 2 decimal points
      storeId: EASYPAY_STORE_ID,
      postBackURL: postBackURL1, // First callback URL (now includes orderRefNum)
      orderRefNum: orderRefNum,
      autoRedirect: '0', // 0 = merchant redirects to final post back URL, 1 = Easypay redirects
      paymentMethod: 'MA_PAYMENT_METHOD', // Assuming Mobile Account payment for now
      emailAddr: email || decodedToken.email,
      mobileNum: phoneNumber,
      // expiryDate: 'YYYYMMDD HHMMSS', // Optional, can add if needed
    };

    // Construct the string for merchantHashedReq (Page 21, Step 4)
    // Based on Easypay guide example: amount=10.0&autoRedirect=0&expiryDate=20150101 151515&orderRefNum=11001&postBackURL=http://localhost:9081/local/status.php&storeId=28
    // We should include all parameters that are part of the request, except those explicitly excluded by Easypay.
    // The example implies alphabetical sorting and URL-encoded key=value pairs.
    
    // Create a temporary object for hashing that includes all parameters Easypay might expect in the hash string.
    // We will include parameters that are sent to Easypay.
    const fieldsToHash = {
      amount: easypayParams.amount,
      storeId: easypayParams.storeId,
      postBackURL: easypayParams.postBackURL,
      orderRefNum: easypayParams.orderRefNum,
      autoRedirect: easypayParams.autoRedirect,
      paymentMethod: easypayParams.paymentMethod,
      emailAddr: easypayParams.emailAddr,
      mobileNum: easypayParams.mobileNum,
      // Add expiryDate if it's ever used
    };

    const sortedFieldNames = Object.keys(fieldsToHash).sort();
    const hashString = sortedFieldNames.map(key => `${key}=${fieldsToHash[key]}`).join('&');

    console.log("Hash String generated:", hashString); // Log the hash string for debugging

    let merchantHashedReq;
    if (EASYPAY_HASH_KEY) {
      merchantHashedReq = encryptAES(hashString, EASYPAY_HASH_KEY);
      easypayParams.merchantHashedReq = merchantHashedReq;
      console.log("Encrypted merchantHashedReq:", merchantHashedReq); // Log encrypted value
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
      hashStringDebug: hashString, // Store hash string for debugging
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
    console.log("Redirecting to Easypay URL:", easypayRedirectUrl); // Log the final redirect URL

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
