// FILE: netlify/functions/handleWorkupPayIPN.js

const admin = require('firebase-admin');
const crypto = require('crypto');

// --- UPDATED FIREBASE INITIALIZATION ---
// This now uses individual environment variables to avoid the 4KB limit.
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

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { status, signature, identifier, data } = JSON.parse(event.body);

  // --- Signature Validation ---
  const customKey = `${data.amount}${identifier}`;
  const mySignature = crypto
    .createHmac('sha256', process.env.WORKUP_PAY_SECRET_KEY)
    .update(customKey)
    .digest('hex')
    .toUpperCase();

  if (signature !== mySignature) {
    console.error('IPN Validation Failed: Signatures do not match.');
    return { statusCode: 400, body: 'Invalid signature.' };
  }
  
  // --- Find user and transaction ---
  const usersSnapshot = await db.collection('users').get();
  let userId = null;
  for (const userDoc of usersSnapshot.docs) {
    const transactionDoc = await db.collection('users').doc(userDoc.id).collection('transactions').doc(identifier).get();
    if (transactionDoc.exists) {
      userId = userDoc.id;
      break;
    }
  }

  if (!userId) {
     console.error(`IPN Error: Could not find transaction for identifier: ${identifier}`);
     return { statusCode: 404, body: 'Transaction not found.' };
  }

  const userRef = db.collection("users").doc(userId);
  const transactionRef = userRef.collection("transactions").doc(identifier);
    
  try {
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const transactionDoc = await t.get(transactionRef);
      
      if (transactionDoc.data().status === 'completed') {
          console.log(`IPN for ${identifier} already processed.`);
          return;
      }
      
      if (status === "success") {
        const amountToAdd = parseFloat(data.amount);
        const newBalance = (userDoc.data().balance || 0) + amountToAdd;
        t.update(userRef, { balance: newBalance });
        t.update(transactionRef, {
            status: 'completed',
            gatewayTransactionId: data.trx,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Handle referral commission if needed
        const userData = userDoc.data();
        if (userData.referredBy) {
          // ... (same commission logic as before)
        }
      } else {
        t.update(transactionRef, { status: 'failed' });
      }
    });
    
    return { statusCode: 200, body: 'IPN Processed' };

  } catch (error) {
    console.error('IPN Transaction failed:', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
