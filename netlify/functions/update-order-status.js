// FILE: netlify/functions/update-order-status.js
// PURPOSE: Automatically runs every minute to update the status of active orders.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
let db;
try {
  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase environment variables are not set. Please check your Netlify site configuration.');
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

exports.handler = async () => {
  console.log('--- Executing update-order-status function ---');

  if (!db) {
    console.error('Firebase Admin not initialized. Exiting function. This is likely due to missing environment variables.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Backend service is not configured correctly.' }) };
  }

  try {
    const ordersQuery = db.collectionGroup('orders').where('status', 'in', ['Pending', 'Processing']);
    const snapshot = await ordersQuery.get();

    if (snapshot.empty) {
      console.log("No active orders found to update.");
      return { statusCode: 200, body: JSON.stringify({ message: "No active orders to update." }) };
    }

    const ordersByProvider = {};
    snapshot.forEach(doc => {
      const order = { docPath: doc.ref.path, ...doc.data() };
      if (order.providerId) {
        if (!ordersByProvider[order.providerId]) {
          ordersByProvider[order.providerId] = [];
        }
        ordersByProvider[order.providerId].push(order);
      }
    });

    const providerIds = Object.keys(ordersByProvider);
    if (providerIds.length === 0) {
      console.log("No orders with a valid providerId found.");
      return { statusCode: 200, body: JSON.stringify({ message: "No orders with a valid providerId found." }) };
    }
    
    const providersSnapshot = await db.collection('api_providers').where(admin.firestore.FieldPath.documentId(), 'in', providerIds).get();
    const providerMap = new Map(providersSnapshot.docs.map(doc => [doc.id, doc.data()]));
    
    const batch = db.batch();
    let updatesCount = 0;

    for (const providerId of providerIds) {
      const provider = providerMap.get(providerId);
      if (!provider) {
        console.warn(`Provider details not found for ID: ${providerId}. Skipping.`);
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

        for (const providerOrderId in statuses) {
          const statusInfo = statuses[providerOrderId];
          const originalOrder = ordersForProvider.find(o => o.providerOrderId.toString() === providerOrderId);
          
          if (originalOrder) {
            const orderRef = db.doc(originalOrder.docPath);
            batch.update(orderRef, {
              status: statusInfo.status,
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
        return { statusCode: 200, body: JSON.stringify({ message: "No order statuses were updated." }) };
    }

  } catch (error) {
    console.error("Error in update-order-status function:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "An internal server error occurred." }) };
  }
};
```javascript
// FILE: netlify/functions/place-order.js
// PURPOSE: Securely places an order after validating user balance.

const admin = require('firebase-admin');
const axios = require('axios');

// --- Firebase Admin Initialization ---
let db;
try {
  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase environment variables are not set. Please check your Netlify site configuration.');
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
  console.log('--- Executing place-order function ---');

  if (!db) {
    console.error('Firebase Admin not initialized. Exiting function.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Backend is not configured correctly. Missing Firebase credentials.' }),
    };
  }

  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: No token provided.' }) };
  }
  
  try {
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { serviceId, link, quantity, charge, serviceName, categoryId } = JSON.parse(event.body);

    const userRef = db.collection('users').doc(userId);
    const orderResult = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found.");
      
      const userData = userDoc.data();
      if (userData.balance < charge) throw new Error("Insufficient balance.");

      const serviceRef = db.collection(`categories/${categoryId}/services`).doc(serviceId);
      const serviceDoc = await serviceRef.get();
      if (!serviceDoc.exists) throw new Error("Service configuration not found.");
      const serviceData = serviceDoc.data();
      
      const providerRef = db.collection('api_providers').doc(serviceData.providerId);
      const providerDoc = await providerRef.get();
      if (!providerDoc.exists) throw new Error("API Provider not found.");
      const { apiUrl, apiKey } = providerDoc.data();

      const requestBody = new URLSearchParams();
      requestBody.append('key', apiKey);
      requestBody.append('action', 'add');
      requestBody.append('service', serviceData.id_api);
      requestBody.append('link', link);
      requestBody.append('quantity', quantity);

      const providerResponse = await axios.post(apiUrl, requestBody);
      const providerOrder = providerResponse.data;

      if (!providerOrder || providerOrder.error) {
        throw new Error(providerOrder.error || "Failed to place order with provider.");
      }

      const newBalance = userData.balance - charge;
      transaction.update(userRef, { balance: newBalance });

      const newOrderRef = db.collection(`users/${userId}/orders`).doc();
      transaction.set(newOrderRef, {
        providerOrderId: providerOrder.order,
        providerId: serviceData.providerId,
        firestoreServiceId: serviceId,
        serviceId: serviceData.id_api,
        serviceName,
        link,
        quantity,
        charge,
        status: 'Pending',
        start_count: null,
        remains: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userEmail: userData.email,
        categoryId,
        providerAllowsRefill: serviceData.providerAllowsRefill || false,
        providerAllowsCancel: serviceData.providerAllowsCancel || false,
      });
      
      return { orderId: newOrderRef.id };
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Order placed successfully!", orderId: orderResult.orderId }) };

  } catch (error) {
    console.error("Order placement failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```javascript