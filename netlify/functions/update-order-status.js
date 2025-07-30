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
      console.log("No orders with a valid providerId found. This is normal if all new orders are already completed.");
      return { statusCode: 200, body: JSON.stringify({ message: "No orders with a valid providerId found." }) };
    }
    
    console.log(`Found active orders for providers: ${providerIds.join(', ')}`);

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
