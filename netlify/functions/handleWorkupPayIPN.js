// FILE: netlify/functions/handleWorkupPayIPN.js

const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK - This block should only appear once per file.
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

  // Parse URL-encoded form data
  const params = new URLSearchParams(event.body);
  const status = params.get('status');
  const signature = params.get('signature');
  const identifier = params.get('identifier');
  const rawData = params.get('data');
  
  // Early exit if essential data is missing
  if (!status || !signature || !identifier || !rawData) {
    console.error('IPN Error: Missing required parameters.');
    return { statusCode: 400, body: 'Missing parameters.' };
  }
  
  const data = JSON.parse(rawData);

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
  
  // --- FIX: Find user and transaction directly via lookup document ---
  const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
  const ipnLookupDoc = await ipnLookupRef.get();

  if (!ipnLookupDoc.exists) {
     console.error(`IPN Error: Could not find lookup for identifier: ${identifier}`);
     return { statusCode: 404, body: 'Transaction lookup not found.' };
  }

  const { userId } = ipnLookupDoc.data();
  const userRef = db.collection("users").doc(userId);
  const transactionRef = userRef.collection("transactions").doc(identifier);
    
  try {
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      const transactionDoc = await t.get(transactionRef);
      
      if (!userDoc.exists() || !transactionDoc.exists()) {
        throw new Error("User or Transaction document not found.");
      }
      
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
        
        // --- Handle referral commission logic ---
        const userData = userDoc.data();
        if (userData.referredBy) {
            const referrerRef = db.collection("users").doc(userData.referredBy);
            const commissionRate = 0.05; // 5%
            const commissionAmount = amountToAdd * commissionRate;

            const referrerDoc = await t.get(referrerRef);
            if (referrerDoc.exists()) {
                 const currentCommission = referrerDoc.data().commissionBalance || 0;
                 t.update(referrerRef, { commissionBalance: currentCommission + commissionAmount });

                 const commissionLogRef = db.collection("users").doc(userData.referredBy).collection("commissions").doc();
                 t.set(commissionLogRef, {
                    amount: commissionAmount,
                    fromUserId: userId,
                    fromUserEmail: userData.email,
                    transactionId: identifier,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                 });

                 console.log(`Awarded ${commissionAmount} commission to referrer ${userData.referredBy}`);
            }
        };