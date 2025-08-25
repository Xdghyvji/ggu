// FILE: netlify/functions/easypay-callback-1.js

const admin = require('firebase-admin');
const axios = require('axios');
const querystring = require('querystring');

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

// Easypay Configuration from Environment Variables
const EASYPAY_PLUGIN_CONFIRM_URL = process.env.EASYPAY_PLUGIN_CONFIRM_URL || 'https://easypay.easypaisa.com.pk/easypay/Confirm.jsf';
const YOUR_APP_URL = process.env.YOUR_APP_URL; // Your Netlify deployed URL

exports.handler = async (event) => {
  console.log('--- easypay-callback-1 function invoked. ---');

  // Easypay redirects the user's browser here with auth_token as a GET parameter
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { auth_token, orderRefNum } = event.queryStringParameters;

  if (!auth_token || !orderRefNum) {
    console.error('Easypay Callback 1 Error: Missing auth_token or orderRefNum.');
    return { statusCode: 400, body: 'Missing parameters from Easypay callback.' };
  }

  try {
    // Retrieve the second postBackURL from Firestore IPN lookup
    const ipnLookupRef = db.collection('ipn_lookups').doc(orderRefNum);
    const ipnLookupDoc = await ipnLookupRef.get();

    if (!ipnLookupDoc.exists) {
      console.error(`Easypay Callback 1 Error: IPN lookup not found for orderRefNum: ${orderRefNum}`);
      // Redirect user to a generic error page
      return {
        statusCode: 302,
        headers: {
          'Location': `${YOUR_APP_URL}/transactions?status=failed&reason=lookup_missing`,
        },
      };
    }

    const { postBackURL2 } = ipnLookupDoc.data();
    if (!postBackURL2) {
        console.error(`Easypay Callback 1 Error: postBackURL2 missing in lookup for orderRefNum: ${orderRefNum}`);
        return {
            statusCode: 302,
            headers: {
                'Location': `${YOUR_APP_URL}/transactions?status=failed&reason=ipn_url_missing`,
            },
        };
    }

    // Perform the server-to-server POST request to Easypay's Confirm.jsf
    // This is the "handshake of trust" (Page 9, Step 2)
    const confirmParams = {
      auth_token: auth_token,
      postBackURL: postBackURL2, // The second callback URL for final status
    };

    console.log(`Sending confirmation to Easypay for order ${orderRefNum} with auth_token: ${auth_token}`);
    const easypayConfirmResponse = await axios.post(EASYPAY_PLUGIN_CONFIRM_URL, querystring.encode(confirmParams), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log(`Easypay Confirm.jsf response for ${orderRefNum}:`, easypayConfirmResponse.data);

    // After this server-to-server call, Easypay will send the final status to postBackURL2.
    // We now redirect the user's browser to a "processing" page on our frontend.
    return {
      statusCode: 302, // HTTP 302 for redirection
      headers: {
        'Location': `${YOUR_APP_URL}/transactions?status=processing&orderRefNum=${orderRefNum}`,
      },
    };

  } catch (error) {
    console.error('Error in easypay-callback-1:', error);
    // Redirect user to an error page on your frontend
    return {
      statusCode: 302,
      headers: {
        'Location': `${YOUR_APP_URL}/transactions?status=failed&reason=callback_error`,
      },
    };
  }
};