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

    console.log(`Placing order for user ${userId}, service ${serviceId}`);

    const userRef = db.collection('users').doc(userId);
    const orderResult = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found.");
      
      const userData = userDoc.data();
      if (userData.balance < charge) throw new Error("Insufficient balance.");

      const serviceRef = db.collection(`categories/${categoryId}/services`).doc(serviceId);
      const serviceDoc = await transaction.get(serviceRef); // Use transaction.get
      if (!serviceDoc.exists) throw new Error("Service configuration not found.");
      const serviceData = serviceDoc.data();
      
      const providerRef = db.collection('api_providers').doc(serviceData.providerId);
      const providerDoc = await transaction.get(providerRef); // Use transaction.get
      if (!providerDoc.exists) throw new Error("API Provider not found.");
      const { apiUrl, apiKey } = providerDoc.data();

      console.log(`Found provider ${serviceData.providerId}. Placing order with API.`);

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
      
      console.log(`Provider accepted order. Provider Order ID: ${providerOrder.order}`);

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
      
      console.log(`Order document created in Firestore: ${newOrderRef.id}`);
      return { orderId: newOrderRef.id };
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Order placed successfully!", orderId: orderResult.orderId }) };

  } catch (error) {
    console.error("Order placement failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
