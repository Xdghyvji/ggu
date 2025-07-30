// FILE: netlify/functions/refill-order.js
// PURPOSE: Handles a user's request to refill a specific order.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
let db;
try {
  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase environment variables are not set.');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
  db = admin.firestore();
} catch (error) {
  console.error('CRITICAL: Firebase Admin Initialization Error:', error.message);
}

exports.handler = async (event) => {
  console.log('--- Executing refill-order function ---');

  if (!db) {
    console.error('Firebase Admin not initialized. Exiting function.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Backend not configured.' }) };
  }
  
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  try {
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { orderId } = JSON.parse(event.body);

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required.' }) };
    }

    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }
    const orderData = orderDoc.data();

    const providerRef = db.doc(`api_providers/${orderData.providerId}`);
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Provider configuration missing.' }) };
    }
    const { apiUrl, apiKey } = providerDoc.data();

    const requestBody = new URLSearchParams();
    requestBody.append('key', apiKey);
    requestBody.append('action', 'refill');
    requestBody.append('order', orderData.providerOrderId);

    const providerResponse = await axios.post(apiUrl, requestBody);
    const refillData = providerResponse.data;

    if (refillData.error) {
      throw new Error(refillData.error);
    }
    
    await orderRef.collection('actions').add({
        type: 'refill_request',
        providerResponse: refillData,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: `Refill request submitted successfully. Refill ID: ${refillData.refill}` }) };

  } catch (error) {
    console.error("Refill request failed:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Failed to process refill request.' }) };
  }
};
```javascript
// FILE: netlify/functions/cancel-order.js
// PURPOSE: Handles a user's request to cancel a specific order.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
let db;
try {
  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase environment variables are not set.');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
  db = admin.firestore();
} catch (error) {
  console.error('CRITICAL: Firebase Admin Initialization Error:', error.message);
}

exports.handler = async (event) => {
  console.log('--- Executing cancel-order function ---');

  if (!db) {
    console.error('Firebase Admin not initialized. Exiting function.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Backend not configured.' }) };
  }
  
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  try {
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { orderId } = JSON.parse(event.body);

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required.' }) };
    }

    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }
    const orderData = orderDoc.data();

    const providerRef = db.doc(`api_providers/${orderData.providerId}`);
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Provider configuration missing.' }) };
    }
    const { apiUrl, apiKey } = providerDoc.data();

    const requestBody = new URLSearchParams();
    requestBody.append('key', apiKey);
    requestBody.append('action', 'cancel');
    requestBody.append('order', orderData.providerOrderId);

    const providerResponse = await axios.post(apiUrl, requestBody);
    const cancelData = providerResponse.data;

    if (cancelData.error) {
      throw new Error(cancelData.error);
    }
    
    await orderRef.collection('actions').add({
        type: 'cancel_request',
        providerResponse: cancelData,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Cancellation request submitted successfully.' }) };

  } catch (error) {
    console.error("Cancel request failed:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Failed to process cancel request.' }) };
  }
};
