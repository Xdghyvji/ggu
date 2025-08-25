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

const COMMISSION_RATE = 0.05;

exports.handler = async (event, context) => {
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
    const data = {
        payment_trx: params.get('data[payment_trx]'),
        amount: parseFloat(rawAmountString),
        payment_type: params.get('data[payment_type]'),
        charge: params.get('data[charge]'),
        currency: {
            code: params.get('data[currency][code]'),
            symbol: params.get('data[currency][symbol]')
        },
    };

    console.log('Parsed data object (for internal use):', data);

    if (!status || !signature || !identifier || isNaN(data.amount) || data.payment_trx === null) {
        console.error('IPN Error: Missing required parameters or invalid data amount.');
        return { statusCode: 400, body: 'Missing parameters.' };
    }
    
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

    const ipnLookupRef = db.collection('ipn_lookups').doc(identifier);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
       console.error(`IPN Error: Could not find lookup for identifier: ${identifier}. This might be an invalid or expired payment session.`);
       return { statusCode: 404, body: 'Transaction lookup not found.' };
    }

    const { userId, transactionId, paymentType, phoneNumber, email } = ipnLookupDoc.data();
    if (!transactionId || transactionId !== identifier) {
        console.error(`IPN Error: Mismatch in transactionId from lookup (${transactionId}) and identifier (${identifier}).`);
        return { statusCode: 400, body: 'Transaction ID mismatch.' };
    }

    const appId = process.env.APP_ID || 'default-app-id';

    const userRef = db.collection("artifacts").doc(appId).collection("users").doc(userId);
    const transactionRef = userRef.collection("transactions").doc(identifier);
    
    try {
        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const transactionDoc = await t.get(transactionRef);

            if (!userDoc.exists || !transactionDoc.exists) {
                console.error(`Transaction Error: User (${userId}) or Transaction (${identifier}) document not found during transaction.`);
                throw new Error("User or Transaction document not found.");
            }
            
            const currentTransactionStatus = transactionDoc.data().status;
            const currentBalance = userDoc.data().balance || 0;
            const userData = userDoc.data();
            
            if (currentTransactionStatus === 'completed' || currentTransactionStatus === 'failed' || currentTransactionStatus === 'cancelled') {
                console.log(`IPN for ${identifier} already processed with status: ${currentTransactionStatus}. Skipping.`);
                return;
            }
            
            if (status === "success") {
              const amountToAdd = data.amount;
              let newBalance = currentBalance;

              if (paymentType === 'fund_deposit') {
                newBalance = currentBalance + amountToAdd;
                t.update(userRef, { balance: newBalance }); // Update user's main balance
                console.log(`User ${userId} balance updated to ${newBalance} for fund deposit.`);

                // Handle referral commission logic
                if (userData.referredBy) {
                    const referrerRef = db.collection("artifacts").doc(appId).collection("users").doc(userData.referredBy);
                    const commissionAmount = amountToAdd * COMMISSION_RATE;

                    const referrerDoc = await t.get(referrerRef);
                    if (referrerDoc.exists) {
                        const currentCommission = referrerDoc.data().commissionBalance || 0;
                        t.update(referrerRef, { commissionBalance: currentCommission + commissionAmount });

                        const commissionLogRef = db.collection("artifacts").doc(appId).collection("users").doc(userData.referredBy).collection("commissions").doc();
                        t.set(commissionLogRef, {
                            amount: commissionAmount,
                            fromUserId: userId,
                            fromUserEmail: userData.email || email,
                            transactionId: identifier,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`Awarded ${commissionAmount} commission to referrer ${userData.referredBy}`);
                    } else {
                        console.warn(`Referrer ${userData.referredBy} not found for commission. Commission not awarded.`);
                    }
                }
              }
              // If paymentType is 'package_activation', no balance update here as it's handled by package logic (if any)

              t.update(transactionRef, {
                  status: 'completed',
                  gatewayTransactionId: data.payment_trx,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  phoneNumber: phoneNumber,
                  email: email,
                  paymentType: paymentType,
              });
              console.log(`Transaction ${identifier} for user ${userId} completed successfully.`);

            } else {
                const firestoreStatus = ['failed', 'cancelled'].includes(status.toLowerCase()) ? status.toLowerCase() : 'failed';
                console.log(`Payment status is ${status} for identifier ${identifier}. Marking as ${firestoreStatus}.`);
                t.update(transactionRef, {
                    status: firestoreStatus,
                    gatewayTransactionId: data.payment_trx,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    failureReason: `Workup Pay status: ${status}`,
                    phoneNumber: phoneNumber,
                    email: email,
                    paymentType: paymentType,
                });
            }
        });

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