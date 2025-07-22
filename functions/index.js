const axios = require("axios");
const admin = require("firebase-admin");

// Securely load the Firebase service account key from environment variables
// This key is Base64 encoded in Netlify's settings for security.
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));

// Initialize Firebase Admin SDK only once to prevent re-initialization on every function call
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// The main handler for the Netlify serverless function
exports.handler = async (event) => {
  // We only want to handle POST requests for creating payments
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse the data sent from the React frontend
    const { amount, userId, userEmail } = JSON.parse(event.body);

    // Basic validation to ensure we have the necessary data
    if (!amount || !userId || !userEmail || amount < 10) {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid request data." }) };
    }

    // Securely get the secret API key from Netlify's environment variables
    const secretKey = process.env.WORKUO_PAY_SECRET_KEY;
    if (!secretKey) {
        console.error("Workuo Pay secret key is not set in environment variables.");
        return { statusCode: 500, body: JSON.stringify({ message: "Payment processor not configured." }) };
    }

    // Create a new, unique document in Firestore for this transaction
    const internalTransactionRef = db.collection("users").doc(userId).collection("transactions").doc();
    const transactionId = internalTransactionRef.id;

    // Prepare the data payload to send to the Workuo Pay API
    const workuoPayPayload = {
      api_key: secretKey,
      amount: amount,
      currency: "PKR",
      order_id: transactionId, // We send our unique ID to them so we can track it
      customer_email: userEmail,
      // **UPDATED**: The URL the user is sent back to after payment
      redirect_url: `https://arhamshop.site/transactions`,
      // **UPDATED**: The URL Workuo Pay will send a confirmation to (the webhook)
      webhook_url: `https://arhamshop.site/.netlify/functions/paymentWebhook`,
    };

    // Make the API call to Workuo Pay to create a payment link
    const response = await axios.post("https://workuppay.co/api/v1/create_payment", workuoPayPayload);

    // Check if the API call was successful and returned a payment URL
    if (response.data && response.data.payment_url) {
      // Create a "pending" transaction record in our database before redirecting the user
      await internalTransactionRef.set({
        amount: amount,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        gateway: "Workuo Pay",
        gatewayTransactionId: response.data.transaction_id || null, // Store their ID if provided
      });

      // Send the payment URL back to the React app
      return {
        statusCode: 200,
        body: JSON.stringify({ paymentUrl: response.data.payment_url }),
      };
    } else {
      throw new Error("Invalid response from payment gateway.");
    }
  } catch (error) {
    // Log any errors for debugging
    console.error("Error creating payment session:", error.response ? error.response.data : error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Could not initiate payment. Please try again later." }),
    };
  }
};
