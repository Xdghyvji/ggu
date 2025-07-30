// FILE: netlify/functions/place-order.js

const admin = require('firebase-admin');
const axios = require('axios'); // Or your preferred HTTP client

// --- Firebase Admin Initialization (ensure this is configured) ---
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

exports.handler = async (event) => {
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
  const { serviceId, link, quantity, charge, serviceName, categoryId } = JSON.parse(event.body);

  // 2. Run a Firestore Transaction to ensure data consistency
  const userRef = db.collection('users').doc(userId);
  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found.");
      }
      const userData = userDoc.data();
      if (userData.balance < charge) {
        throw new Error("Insufficient balance.");
      }

      // 3. Place the order with the SMM provider
      // First, get provider details from the service document
      const serviceRef = db.collection(`categories/${categoryId}/services`).doc(serviceId); // Assuming serviceId is the doc ID now
      const serviceDoc = await serviceRef.get();
      if (!serviceDoc.exists) throw new Error("Service configuration not found.");
      
      const providerRef = db.collection('api_providers').doc(serviceDoc.data().providerId);
      const providerDoc = await providerRef.get();
      if (!providerDoc.exists) throw new Error("API Provider not found.");
      
      const { apiUrl, apiKey } = providerDoc.data();
      const providerServiceId = serviceDoc.data().providerServiceId;

      const requestBody = new URLSearchParams();
      requestBody.append('key', apiKey);
      requestBody.append('action', 'add');
      requestBody.append('service', providerServiceId);
      requestBody.append('link', link);
      requestBody.append('quantity', quantity);

      const providerResponse = await axios.post(apiUrl, requestBody);
      const providerOrder = providerResponse.data;

      if (!providerOrder || !providerOrder.order) {
        throw new Error(providerOrder.error || "Failed to place order with provider.");
      }

      // 4. Deduct balance and create the order document
      const newBalance = userData.balance - charge;
      transaction.update(userRef, { balance: newBalance });

      const newOrderRef = db.collection(`users/${userId}/orders`).doc();
      transaction.set(newOrderRef, {
        providerOrderId: providerOrder.order, // IMPORTANT: Save the provider's order ID
        serviceId: serviceDoc.data().id_api,
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
      });
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Order placed successfully!" }) };

  } catch (error) {
    console.error("Order placement failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};