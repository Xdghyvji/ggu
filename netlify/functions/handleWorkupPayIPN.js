// FILE: netlify/functions/handleWorkupPayIPN.js

const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK - This block should only appear once per file.
// Ensure your Netlify environment variables FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY,
// and FIREBASE_CLIENT_EMAIL are correctly set.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newline characters in private key
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

// Commission rate for referrals (e.g., 5%)
const COMMISSION_RATE = 0.05;

exports.handler = async (event, context) => {
    console.log('handleWorkupPayIPN function invoked.');
    console.log('Received raw event body:', event.body);
    console.log('Received event headers:', event.headers);

    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed, returning 405.');
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Parse URL-encoded form data from the event body
    const params = new URLSearchParams(event.body);

    const status = params.get('status'); // 'success', 'failed', 'cancelled', etc.
    const signature = params.get('signature');
    const identifier = params.get('identifier'); // This is your unique transaction ID from createPaymentSession

    // Extract data fields, ensuring they are correctly parsed
    const rawAmountString = params.get('data[amount]');
    const data = {
        payment_trx: params.get('data[payment_trx]'), // Workup Pay's internal transaction ID
        amount: parseFloat(rawAmountString),
        payment_type: params.get('data[payment_type]'),
        charge: params.get('data[charge]'),
        currency: {
            code: params.get('data[currency][code]'),
            symbol: params.get('data[currency][symbol]')
        },
        // Add any other 'data[key]' parameters you expect from Workup Pay
    };

    console.log('Parsed data object (for internal use):', data);

    // Basic validation for essential parameters
    if (!status || !signature || !identifier || isNaN(data.amount) || data.payment_trx === null) {
        console.error('IPN Error: Missing required parameters or invalid data amount.');
        return { statusCode: 400, body: 'Missing parameters.' };
    }
  
    // --- Signature Validation ---
    // Use the original string amount for signature generation to match Workup Pay's hash
    const customKey = `${rawAmountString}${identifier}`;
    const mySignature = crypto
        .createHmac('sha256', process.env.WORKUP_PAY_SECRET_KEY)
        .update(customKey)
        .digest('hex')
        .toUpperCase();

    console.log('Signature received from Workup Pay:', signature);
    console.log('Calculated customKey for hash:', customKey);
    console.log('Calculated mySignature:', mySignature);

    if (signature !== mySignature) {
        console.error('IPN Validation Failed: Signatures do not match.');
        return { statusCode: 400, body: 'Invalid signature.' };
    }
    console.log('Signature validated successfully.');

    // --- Find the corresponding transaction using the identifier from ipn_lookups ---
    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
       console.error(`IPN Error: Could not find lookup for identifier: ${identifier}. This might be an invalid or expired payment session.`);
       return { statusCode: 404, body: 'Transaction lookup not found.' };
    }

    const { userId, transactionId } = ipnLookupDoc.data();
    // Ensure transactionId is correctly retrieved, it should be the same as identifier
    if (!transactionId || transactionId !== identifier) {
        console.error(`IPN Error: Mismatch in transactionId from lookup (${transactionId}) and identifier (${identifier}).`);
        return { statusCode: 400, body: 'Transaction ID mismatch.' };
    }

    const userRef = db.collection("users").doc(userId);
    // The transaction document is within the user's subcollection, using the identifier as its ID
    const transactionRef = userRef.collection("transactions").doc(identifier);
    
    try {
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const transactionDoc = await t.get(transactionRef);

            // Check if user or transaction document exists. If not, throw an error.
            // Using .exists (boolean property) is safer for Admin SDK.
            if (!userDoc.exists || !transactionDoc.exists) {
                console.error(`Transaction Error: User (${userId}) or Transaction (${identifier}) document not found during transaction.`);
                throw new Error("User or Transaction document not found.");
            }
      
            // Get current data to check status and prevent double processing
            const currentTransactionStatus = transactionDoc.data().status;
            const currentBalance = userDoc.data().balance || 0;
            const userData = userDoc.data();
      
            if (currentTransactionStatus === 'completed' || currentTransactionStatus === 'failed' || currentTransactionStatus === 'cancelled') {
                console.log(`IPN for ${identifier} already processed with status: ${currentTransactionStatus}. Skipping.`);
                return; // Exit if already processed
            }
      
            if (status === "success") {
              const amountToAdd = data.amount;
              const newBalance = currentBalance + amountToAdd;

              // 1. Update user's main balance
              t.update(userRef, { balance: newBalance });

              // 2. Update the specific transaction status
              t.update(transactionRef, {
                  status: 'completed',
                  gatewayTransactionId: data.payment_trx,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
        
              // 3. Handle referral commission logic
              if (userData.referredBy) {
                  const referrerRef = db.collection("users").doc(userData.referredBy);
                  const commissionAmount = amountToAdd * COMMISSION_RATE;

                  const referrerDoc = await t.get(referrerRef);
                  if (referrerDoc.exists) {
                      const currentCommission = referrerDoc.data().commissionBalance || 0;
                      t.update(referrerRef, { commissionBalance: currentCommission + commissionAmount });

                      // Log commission in referrer's subcollection
                      const commissionLogRef = doc(collection(referrerRef, "commissions"));
                      t.set(commissionLogRef, {
                          amount: commissionAmount,
                          fromUserId: userId,
                          fromUserEmail: userData.email,
                          transactionId: identifier, // Reference the original transaction
                          createdAt: admin.firestore.FieldValue.serverTimestamp()
                      });
                      console.log(`Awarded ${commissionAmount} commission to referrer ${userData.referredBy}`);
                  } else {
                        console.warn(`Referrer ${userData.referredBy} not found for commission. Commission not awarded.`);
                    }
              }
            console.log(`Transaction ${identifier} for user ${userId} completed successfully. New balance: ${newBalance}`);

            } else { // Handle non-success statuses (e.g., 'failed', 'cancelled', or any other unexpected status)
                // Determine the status to set in Firestore. Default to 'failed' if specific status is not recognized.
                const firestoreStatus = ['failed', 'cancelled'].includes(status.toLowerCase()) ? status.toLowerCase() : 'failed';
              console.log(`Payment status is ${status} for identifier ${identifier}. Marking as ${firestoreStatus}.`);
              t.update(transactionRef, {
                  status: firestoreStatus,
                  gatewayTransactionId: data.payment_trx,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  failureReason: `Workup Pay status: ${status}`
              });
                // No balance change needed for failed/cancelled payments if funds were not pre-dedu.
            }
        }); // End of db.runTransaction

        console.log(`IPN for ${identifier} processed successfully.`);
        return { statusCode: 200, body: 'IPN processed successfully.' };

    } catch (error) {
        console.error('Firestore Transaction Failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal server error occurred during IPN processing.' }),
        };
    }
};
