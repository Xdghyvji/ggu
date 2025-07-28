// FILE: netlify/functions/handleWorkupPayIPN.js

const admin = require('firebase-admin');
const crypto = require('crypto');

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

const COMMISSION_RATE = 0.05; // 5%

exports.handler = async (event, context) => {
    // These first logs are essential. If you don't see them, Netlify is not invoking your function.
    console.log('handleWorkupPayIPN function invoked.');
    console.log('Received raw event body:', event.body);
    console.log('Received event headers:', event.headers);

    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed, returning 405.');
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const params = new URLSearchParams(event.body);
    const status = params.get('status');
    const signature = params.get('signature');
    const identifier = params.get('identifier');
    const rawAmountString = params.get('data[amount]');
    const paymentTrx = params.get('data[payment_trx]');
    const amount = parseFloat(rawAmountString);

    console.log(`IPN Received: status=${status}, identifier=${identifier}, amount=${amount}, payment_trx=${paymentTrx}`);

    if (!status || !signature || !identifier || isNaN(amount) || !paymentTrx) {
        console.error('IPN Error: Missing required parameters.');
        return { statusCode: 400, body: 'Missing required parameters.' };
    }
  
    // --- Signature Validation ---
    const customKey = `${rawAmountString}${identifier}`;
    const mySignature = crypto
        .createHmac('sha256', process.env.WORKUP_PAY_SECRET_KEY)
        .update(customKey)
        .digest('hex')
        .toUpperCase();

    console.log('Signature received:', signature);
    console.log('Calculated signature:', mySignature);

    if (signature !== mySignature) {
        console.error('IPN Validation Failed: Signatures do not match.');
        return { statusCode: 400, body: 'Invalid signature.' };
    }
    console.log('Signature validated successfully.');

    // --- Find the corresponding transaction using the identifier from ipn_lookups ---
    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
       console.error(`IPN Error: Could not find lookup for identifier: ${identifier}.`);
       return { statusCode: 404, body: 'Transaction lookup not found.' };
    }

    // **BUG FIX:** Correctly destructuring the data saved in the previous step.
    const { userId, transactionId } = ipnLookupDoc.data();
    
    // The transactionId from the lookup should be the same as the identifier from the IPN body.
    if (!userId || !transactionId || transactionId !== identifier) {
        console.error(`IPN Error: Mismatch in lookup data for identifier: ${identifier}. Found userId: ${userId}, transactionId: ${transactionId}`);
        return { statusCode: 400, body: 'Transaction ID mismatch in lookup.' };
    }

    console.log(`Found user ${userId} for transaction ${transactionId}`);

    const userRef = db.collection("users").doc(userId);
    const transactionRef = userRef.collection("transactions").doc(transactionId);
    
    try {
        await db.runTransaction(async (t) => {
            const transactionDoc = await t.get(transactionRef);
            
            if (!transactionDoc.exists) {
                console.error(`Transaction Error: Transaction document ${transactionId} not found for user ${userId}.`);
                throw new Error("Transaction document not found.");
            }
          
            const currentTransactionData = transactionDoc.data();
            // Prevent double processing
            if (currentTransactionData.status !== 'pending') {
                console.log(`IPN for ${transactionId} already processed with status: ${currentTransactionData.status}. Skipping.`);
                return;
            }
          
            if (status === "success") {
                const userDoc = await t.get(userRef);
                if (!userDoc.exists) {
                    console.error(`Transaction Error: User document ${userId} not found.`);
                    throw new Error("User document not found.");
                }

                const userData = userDoc.data();
                const currentBalance = userData.balance || 0;
                const newBalance = currentBalance + amount;

                // 1. Update user's main balance
                t.update(userRef, { balance: newBalance });

                // 2. Update the specific transaction status
                t.update(transactionRef, {
                    status: 'completed',
                    gatewayTransactionId: paymentTrx,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
        
                // 3. Handle referral commission logic
                if (userData.referredBy) {
                    const referrerRef = db.collection("users").doc(userData.referredBy);
                    const commissionAmount = amount * COMMISSION_RATE;
                    // Use FieldValue to increment atomically, which is safer.
                    t.update(referrerRef, { 
                        commissionBalance: admin.firestore.FieldValue.increment(commissionAmount) 
                    });
                    console.log(`Awarded ${commissionAmount} commission to referrer ${userData.referredBy}`);
                }
                console.log(`Transaction ${transactionId} for user ${userId} completed successfully. New balance: ${newBalance}`);

            } else { // Handle non-success statuses
                const firestoreStatus = ['failed', 'cancelled'].includes(status.toLowerCase()) ? status.toLowerCase() : 'failed';
                console.log(`Payment status is ${status} for identifier ${transactionId}. Marking as ${firestoreStatus}.`);
                t.update(transactionRef, {
                    status: firestoreStatus,
                    gatewayTransactionId: paymentTrx,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    failureReason: `Workup Pay IPN status: ${status}`
                });
            }
        }); // End of db.runTransaction

        console.log(`IPN for ${identifier} processed successfully.`);
        return { statusCode: 200, body: 'IPN processed successfully.' };

    } catch (error) {
        console.error('Firestore Transaction Failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal server error during IPN processing.' }),
        };
    }
};
