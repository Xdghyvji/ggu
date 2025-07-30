// FILE: netlify/functions/update-order-status.js
// PURPOSE: Automatically runs every minute to update the status of active orders.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
// Ensure you have set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your Netlify environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async () => {
  try {
    // 1. Get all 'Pending' or 'Processing' orders from all users
    const ordersQuery = db.collectionGroup('orders').where('status', 'in', ['Pending', 'Processing']);
    const snapshot = await ordersQuery.get();

    if (snapshot.empty) {
      console.log("No active orders to update.");
      return { statusCode: 200, body: JSON.stringify({ message: "No active orders to update." }) };
    }

    // 2. Group orders by their provider to make batch requests
    const ordersByProvider = {};
    snapshot.forEach(doc => {
      const order = {
        docPath: doc.ref.path, // Store the full path to the document
        ...doc.data()
      };
      
      // Ensure the order has a providerId to be processed
      if (order.providerId) {
        if (!ordersByProvider[order.providerId]) {
          ordersByProvider[order.providerId] = [];
        }
        ordersByProvider[order.providerId].push(order);
      }
    });

    // 3. Fetch provider details from Firestore
    const providerIds = Object.keys(ordersByProvider);
    if (providerIds.length === 0) {
        console.log("No orders with a valid providerId found.");
        return { statusCode: 200, body: JSON.stringify({ message: "No orders with a valid providerId found." }) };
    }
    const providersSnapshot = await db.collection('api_providers').where(admin.firestore.FieldPath.documentId(), 'in', providerIds).get();
    const providerMap = new Map(providersSnapshot.docs.map(doc => [doc.id, doc.data()]));
    
    const batch = db.batch();
    let updatesCount = 0;

    // 4. Iterate through each provider and fetch status updates for their orders
    for (const providerId of providerIds) {
      const provider = providerMap.get(providerId);
      if (!provider) {
        console.warn(`Provider details not found for providerId: ${providerId}. Skipping.`);
        continue;
      }

      const ordersForProvider = ordersByProvider[providerId];
      const providerOrderIds = ordersForProvider.map(o => o.providerOrderId).join(',');
      
      const requestBody = new URLSearchParams();
      requestBody.append('key', provider.apiKey);
      requestBody.append('action', 'status');
      requestBody.append('orders', providerOrderIds);

      try {
        const response = await axios.post(provider.apiUrl, requestBody);
        const statuses = response.data;

        // 5. Update each order in Firestore with the new status from the provider
        for (const providerOrderId in statuses) {
          const statusInfo = statuses[providerOrderId];
          const originalOrder = ordersForProvider.find(o => o.providerOrderId.toString() === providerOrderId);
          
          if (originalOrder) {
            const orderRef = db.doc(originalOrder.docPath);
            batch.update(orderRef, {
              status: statusInfo.status, // e.g., "Processing", "Completed", "Canceled"
              start_count: parseInt(statusInfo.start_count, 10) || null,
              remains: parseInt(statusInfo.remains, 10) || null,
            });
            updatesCount++;
          }
        }
      } catch (providerError) {
          console.error(`Failed to fetch status from provider ${providerId}:`, providerError.message);
      }
    }

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`Successfully updated ${updatesCount} orders.`);
        return { statusCode: 200, body: JSON.stringify({ message: `Successfully updated ${updatesCount} orders.` }) };
    } else {
        console.log("No order statuses were updated in this run.");
        return { statusCode: 200, body: JSON.stringify({ message: "No order statuses were updated in this run." }) };
    }

  } catch (error) {
    console.error("Error in update-order-status function:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "An internal server error occurred." }) };
  }
};
```javascript
// FILE: netlify/functions/refill-order.js
// PURPOSE: Handles a user's request to refill a specific order.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  // 1. Authenticate the user
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }
  const userId = decodedToken.uid;
  const { orderId } = JSON.parse(event.body);

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required.' }) };
  }

  try {
    // 2. Get the order details from Firestore
    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }
    const orderData = orderDoc.data();

    // 3. Get the API provider's details
    const providerRef = db.doc(`api_providers/${orderData.providerId}`);
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Provider configuration missing.' }) };
    }
    const { apiUrl, apiKey } = providerDoc.data();

    // 4. Send the refill request to the provider's API
    const requestBody = new URLSearchParams();
    requestBody.append('key', apiKey);
    requestBody.append('action', 'refill');
    requestBody.append('order', orderData.providerOrderId);

    const providerResponse = await axios.post(apiUrl, requestBody);
    const refillData = providerResponse.data;

    if (refillData.error) {
      throw new Error(refillData.error);
    }
    
    // 5. Optionally, log the refill request
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
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  // 1. Authenticate the user
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }
  const userId = decodedToken.uid;
  const { orderId } = JSON.parse(event.body);

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Order ID is required.' }) };
  }

  try {
    // 2. Get the order details from Firestore
    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found.' }) };
    }
    const orderData = orderDoc.data();

    // 3. Get the API provider's details
    const providerRef = db.doc(`api_providers/${orderData.providerId}`);
    const providerDoc = await providerRef.get();
    if (!providerDoc.exists) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Provider configuration missing.' }) };
    }
    const { apiUrl, apiKey } = providerDoc.data();

    // 4. Send the cancel request to the provider's API
    const requestBody = new URLSearchParams();
    requestBody.append('key', apiKey);
    requestBody.append('action', 'cancel');
    requestBody.append('order', orderData.providerOrderId);

    const providerResponse = await axios.post(apiUrl, requestBody);
    const cancelData = providerResponse.data;

    if (cancelData.error) {
      throw new Error(cancelData.error);
    }
    
    // 5. Log the cancellation request. The main status update function will handle refunds if the status changes to "Canceled".
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
