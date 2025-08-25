import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, collection, query, onSnapshot, setDoc } from 'firebase/firestore';

// Provided Firebase configuration details
const firebaseConfig = {
  apiKey: "AIzaSyBVruE0hRVZisHlnnyuWBl-PZp3-DMp028",
  authDomain: "pakages-provider.firebaseapp.com",
  projectId: "pakages-provider",
  storageBucket: "pakages-provider.firebasestorage.app",
  messagingSenderId: "109547136506",
  appId: "1:109547136506:web:c9d34657d73b0fcc3ef043",
  measurementId: "G-672LC3842S"
};

// App ID for Firestore rules (will be populated by runtime, or fallback)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Data for mobile packages with updated logos
const packagesData = [
  {
    company: 'Ufone',
    logo: 'https://cdn.bitrefill.com/content/cn/b_rgb%3AFFFFFF%2Cc_pad%2Ch_720%2Cw_1280/v1568917815/u-fone.webp',
    packages: [
      { id: 'ufone-1m', duration: '1 Month', gb: 155, mins: 1150, sms: 900, price: 1000 },
      { id: 'ufone-3m', duration: '3 Months', gb: 420, mins: 3000, sms: 2000, price: 1300 },
      { id: 'ufone-6m', duration: '6 Months', gb: 850, mins: 4800, sms: 3500, price: 1650 },
      { id: 'ufone-12m', duration: '12 Months', gb: 1700, mins: 7600, sms: 5000, price: 2000 },
    ],
  },
  {
    company: 'Telenor',
    logo: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2019/02/Telenor-Logo-Digital-03.png',
    packages: [
      { id: 'telenor-1m', duration: '1 Month', gb: 150, mins: 1100, sms: 850, price: 950 },
      { id: 'telenor-3m', duration: '3 Months', gb: 400, mins: 2900, sms: 2200, price: 1250 },
      { id: 'telenor-6m', duration: '6 Months', gb: 850, mins: 4700, sms: 3200, price: 1600 },
      { id: 'telenor-12m', duration: '12 Months', gb: 1650, mins: 10000, sms: 6000, price: 1950 },
    ],
  },
  {
    company: 'Zong',
    logo: 'https://www.phoneworld.com.pk/wp-content/uploads/2017/11/zong.jpg',
    packages: [
      { id: 'zong-1m', duration: '1 Month', gb: 170, mins: 1200, sms: 900, price: 900 },
      { id: 'zong-3m', duration: '3 Months', gb: 450, mins: 3000, sms: 2100, price: 1250 },
      { id: 'zong-6m', duration: '6 Months', gb: 850, mins: 5000, sms: 3500, price: 1550 },
      { id: 'zong-12m', duration: '12 Months', gb: 1600, mins: 8000, sms: 5000, price: 1900 },
    ],
  },
  {
    company: 'Jazz',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRprLrEPisIxYwkJ25vlpimCQ8GHTXHyd7qtg&s',
    packages: [
      { id: 'jazz-1m', duration: '1 Month', gb: 160, mins: 1000, sms: 700, price: 850 },
      { id: 'jazz-3m', duration: '3 Months', gb: 420, mins: 2800, sms: 1900, price: 1150 },
      { id: 'jazz-6m', duration: '6 Months', gb: 800, mins: 4500, sms: 3000, price: 1450 },
      { id: 'jazz-12m', duration: '12 Months', gb: 1500, mins: 6500, sms: 4000, price: 1800 },
    ],
  },
];

// Hero logos for the landing page slider
const heroLogos = [
  { src: 'https://cdn.bitrefill.com/content/cn/b_rgb%3AFFFFFF%2Cc_pad%2Ch_720%2Cw_1280/v1568917815/u-fone.webp', alt: 'Ufone Logo' },
  { src: 'https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2019/02/Telenor-Logo-Digital-03.png', alt: 'Telenor Logo' },
  { src: 'https://www.phoneworld.com.pk/wp-content/uploads/2017/11/zong.jpg', alt: 'Zong Logo' },
  { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRprLrEPisIxYwkJ25vlpimCQ8GHTXHyd7qtg&s', alt: 'Jazz Logo' },
];

// MessageModal Component: For displaying alerts/messages
const MessageModal = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
                  type === 'error' ? 'bg-red-100 border-red-400 text-red-700' :
                  'bg-blue-100 border-blue-400 text-blue-700';
  const borderColor = type === 'success' ? 'border-green-500' :
                      type === 'error' ? 'border-red-500' :
                      'border-blue-500';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`relative ${bgColor} border-l-4 ${borderColor} rounded-md p-6 shadow-lg max-w-sm w-full`}>
        <p className="font-semibold text-lg mb-2">{type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Information'}</p>
        <p>{message}</p>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          &times;
        </button>
      </div>
    </div>
  );
};


// PackageCard Component: Displays individual package details
const PackageCard = ({ pkg, onActivate, activatingPackageId, isAuthenticated, customerPhoneNumber }) => {
  const isActivating = activatingPackageId === pkg.id;
  const isPhoneNumberProvided = !!customerPhoneNumber && customerPhoneNumber !== '+92'; // Check if phone number is provided and not just default

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 m-4 w-full sm:w-80 flex-shrink-0 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">{pkg.duration}</h3>
      <div className="space-y-3">
        <p className="flex items-center text-gray-700">
          <svg className="w-5 h-5 text-indigo-500 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
          <span className="font-medium">Data:</span> {pkg.gb} GB
        </p>
        <p className="flex items-center text-gray-700">
          <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.928.688l2.04 5.983 5.589-3.411a1 1 0 011.233.575l1.082 2.706a1 1 0 00.99 1.139l.758-.152A1 1 0 0018 9v2a1 1 0 00-1 1v2a1 1 0 00-1 1H2a1 1 0 00-1 1V3a1 1 0 011-1zM16 11h2v2h-2v-2zm0 4h2v2h-2v-2z"></path></svg>
          <span className="font-medium">Mins:</span> {pkg.mins}
        </p>
        <p className="flex items-center text-gray-700">
          <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm1.586 2.293a1 1 0 00-1.414 1.414L5 10.414l-2.086 2.086a1 1 0 001.414 1.414L6.414 11.828l2.086 2.086a1 1 0 001.414-1.414L8.414 10.414l2.086-2.086a1 1 0 00-1.414-1.414L7 9.586l-2.086-2.086zM15 7h-2v2h2V7zm0 4h-2v2h2v-2z"></path></svg>
          <span className="font-medium">SMS:</span> {pkg.sms}
        </p>
      </div>
      <div className="mt-6 text-center">
        <p className="text-3xl font-bold text-indigo-600">Rs. {pkg.price}</p>
        <button
          onClick={() => onActivate(pkg)}
          disabled={isActivating || !isAuthenticated || !isPhoneNumberProvided} // Disabled if not authenticated OR no phone number
          className={`mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full shadow-md transition-colors duration-300 ${isActivating || !isAuthenticated || !isPhoneNumberProvided ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isActivating ? 'Activating...' : !isAuthenticated ? 'Login to Activate' : !isPhoneNumberProvided ? 'Enter Mobile Number' : 'Activate'}
        </button>
      </div>
    </div>
  );
};

// AddFundsModal Component
const AddFundsModal = ({ isOpen, onClose, onAddFunds, loading, customerPhoneNumber, setCustomerPhoneNumber }) => {
  const [amount, setAmount] = useState(1); // Minimum 1 Rs
  const [selectedGateway, setSelectedGateway] = useState('WorkupPay');

  const handleAddFundsClick = () => {
    if (amount < 1) {
      alert("Minimum fund addition is 1 Rs.");
      return;
    }
    if (!customerPhoneNumber || customerPhoneNumber === '+92' || !/^((\+92)|(0092))?-?(\d{3})?-?(\d{7})$|^0?3\d{2}-?\d{7}$/.test(customerPhoneNumber)) {
      alert("Please enter a valid Pakistani mobile number.");
      return;
    }
    onAddFunds(amount, customerPhoneNumber, selectedGateway);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Add Funds to Your Wallet</h2>
        
        <div className="mb-4">
          <label htmlFor="fund-amount" className="block text-gray-700 text-lg font-medium mb-2">
            Amount (PKR):
          </label>
          <input
            type="number"
            id="fund-amount"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value)))} // Enforce minimum 1 Rs
            min="1"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            disabled={loading}
          />
          <p className="text-sm text-gray-500 mt-1">Minimum fund addition is 1 Rs.</p>
        </div>

        <div className="mb-6">
          <label htmlFor="mobile-num-funds" className="block text-gray-700 text-lg font-medium mb-2">
            Your Mobile Number:
          </label>
          <input
            type="tel"
            id="mobile-num-funds"
            value={customerPhoneNumber}
            onChange={(e) => setCustomerPhoneNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            placeholder="e.g., +923001234567"
            disabled={loading}
          />
          <p className="text-sm text-gray-500 mt-1">This number will be used for payment processing.</p>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-lg font-medium mb-2">
            Choose Payment Gateway:
          </label>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setSelectedGateway('WorkupPay')}
              className={`flex-1 py-3 px-6 rounded-lg text-lg font-semibold transition-colors duration-200 ${
                selectedGateway === 'WorkupPay' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={loading}
            >
              Workup Pay
            </button>
            <button
              onClick={() => setSelectedGateway('Easypaisa')}
              className={`flex-1 py-3 px-6 rounded-lg text-lg font-semibold transition-colors duration-200 ${
                selectedGateway === 'Easypaisa' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={loading}
            >
              Easypaisa
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-full transition-colors duration-200"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAddFundsClick}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Processing...' : `Add ${amount} Rs`}
          </button>
        </div>
      </div>
    </div>
  );
};


// App Component
export default function App() {
  const [selectedCompany, setSelectedCompany] = useState(packagesData[0].company);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userBalance, setUserBalance] = useState(0); // Re-introduced balance
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activatingPackageId, setActivatingPackageId] = useState(null);

  const [firebaseApp, setFirebaseApp] = useState(null);
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);

  const [customerPhoneNumber, setCustomerPhoneNumber] = useState('+92');
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false); // State for Add Funds modal

  // Initialize Firebase
  useEffect(() => {
    if (!firebaseApp && Object.keys(firebaseConfig).length > 0) {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setFirebaseApp(app);
      setAuth(authInstance);
      setDb(dbInstance);

      onAuthStateChanged(authInstance, (user) => {
        if (user) {
          setUserId(user.uid);
          setUserEmail(user.email);
          setAuthReady(true);
        } else {
          setUserId(null);
          setUserEmail(null);
          setAuthReady(true);
        }
      });
    }
  }, [firebaseApp, firebaseConfig]);

  // Effect for hero image slider
  useEffect(() => {
    let sliderInterval;
    if (!userId && authReady) {
      sliderInterval = setInterval(() => {
        setCurrentHeroImageIndex((prevIndex) => (prevIndex + 1) % heroLogos.length);
      }, 3000);
    }
    return () => clearInterval(sliderInterval);
  }, [userId, authReady, heroLogos.length]);

  // Fetch user data (balance and transactions) once auth is ready and userId is available
  useEffect(() => {
    if (authReady && db && userId) {
      const userDocRef = doc(db, "artifacts", appId, "users", userId); 

      const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserBalance(docSnap.data().balance || 0); // Re-introduced balance
          setCustomerPhoneNumber(docSnap.data().customerPhoneNumber || '+92');
        } else {
          setDoc(userDocRef, { 
              balance: 0, // Initialize balance for new users
              createdAt: new Date(), 
              email: auth.currentUser?.email || 'N/A',
              displayName: auth.currentUser?.displayName || 'N/A',
              customerPhoneNumber: '+92'
          }, { merge: true })
            .then(() => console.log("User profile created/merged."))
            .catch(e => console.error("Error setting user profile:", e));
        }
      }, (err) => {
        console.error("Error fetching user profile:", err);
        setError("Failed to fetch user profile data.");
      });

      const transactionsColRef = collection(db, "artifacts", appId, "users", userId, "transactions");
      const q = query(transactionsColRef); 

      const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        const fetchedTransactions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate().toLocaleString(),
          updatedAt: doc.data().updatedAt?.toDate().toLocaleString(),
        }));
        fetchedTransactions.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : 0;
          const dateB = b.createdAt ? new Date(b.createdAt) : 0;
          return dateB - dateA;
        });
        setTransactions(fetchedTransactions);
      }, (err) => {
        console.error("Error fetching transactions:", err);
        setError("Failed to fetch transactions.");
      });

      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('status');
      const orderRefNum = params.get('orderRefNum');
      const gateway = params.get('gateway'); // New: for distinguishing gateway in success/cancel

      if (paymentStatus === 'success') {
        setSuccessMessage(`Payment via ${gateway || 'gateway'} completed successfully! Your balance will update shortly.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === 'cancelled') {
        setError(`Payment via ${gateway || 'gateway'} was cancelled.`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === 'processing' && orderRefNum) {
        setSuccessMessage(`Payment for order ${orderRefNum} is being processed. Please wait...`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      return () => {
        unsubscribeProfile();
        unsubscribeTransactions();
      };
    }
  }, [authReady, db, userId, appId, auth]);

  const handleCompanyChange = (event) => {
    setSelectedCompany(event.target.value);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSuccessMessage('Successfully logged in with Google!');
    } catch (err) {
      console.error('Error with Google login:', err);
      setError(`Failed to log in with Google: ${err.message}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await signOut(auth);
      setSuccessMessage("Logged out successfully!");
      setUserId(null);
      setUserEmail(null);
      setUserBalance(0); // Reset balance on logout
      setTransactions([]);
      setCustomerPhoneNumber('+92');
    } catch (err) {
      console.error("Error logging out:", err);
      setError(`Failed to log out: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async (amount, phoneNumber, gateway, paymentType) => {
    if (!userId || !auth || !auth.currentUser) {
      setError("Please log in to proceed.");
      return;
    }
    const pakistanPhoneNumberRegex = /^((\+92)|(0092))?-?(\d{3})?-?(\d{7})$|^0?3\d{2}-?\d{7}$/;
    if (!phoneNumber || phoneNumber === '+92' || !pakistanPhoneNumberRegex.test(phoneNumber)) {
      setError("Please enter a valid Pakistani mobile number (e.g., +923001234567 or 03001234567).");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const idToken = await auth.currentUser.getIdToken();
      let endpoint = '';
      if (gateway === 'WorkupPay') {
        endpoint = '/.netlify/functions/initiate-payment'; // Workup Pay function
      } else if (gateway === 'Easypaisa') {
        endpoint = '/.netlify/functions/easypay-initiate-payment'; // Easypay function
      } else {
        setError("Invalid payment gateway selected.");
        setLoading(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount: amount,
          phoneNumber: phoneNumber,
          email: userEmail,
          paymentType: paymentType, // Pass payment type to backend
        }),
      });

      const result = await response.json();

      if (response.ok && result.paymentUrl) {
        setSuccessMessage(`Initiating payment via ${gateway} for ${amount} Rs. Redirecting...`);
        if (db && userId && phoneNumber) {
          const userDocRef = doc(db, "artifacts", appId, "users", userId);
          setDoc(userDocRef, { customerPhoneNumber: phoneNumber }, { merge: true })
            .catch(e => console.error("Error saving customer phone number:", e));
        }
        window.location.href = result.paymentUrl;
      } else {
        setError(result.error || `Failed to initiate ${gateway} payment.`);
      }
    } catch (err) {
      console.error(`Payment initiation error via ${gateway}:`, err);
      setError(`An error occurred while trying to initiate payment via ${gateway}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle package activation
  const handleActivatePackage = async (pkg) => {
    setActivatingPackageId(pkg.id);
    await initiatePayment(pkg.price, customerPhoneNumber, 'Easypaisa', 'package_activation'); // Default to Easypaisa for package
    setActivatingPackageId(null);
  };

  // Function to handle adding funds
  const handleAddFunds = async (amount, phoneNumber, gateway) => {
    setIsAddFundsModalOpen(false); // Close modal immediately
    await initiatePayment(amount, phoneNumber, gateway, 'fund_deposit');
  };

  const currentCompany = packagesData.find(
    (company) => company.company === selectedCompany
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 font-inter text-gray-800">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: #4f46e5;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .google-icon {
          background: white;
          border-radius: 50%;
          padding: 2px;
        }
        .hero-image-fade {
          opacity: 1;
          transition: opacity 1s ease-in-out;
        }
        .hero-image-fade.hidden {
          opacity: 0;
        }
      `}</style>

      <MessageModal message={error} type="error" onClose={() => setError(null)} />
      <MessageModal message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />
      <AddFundsModal
        isOpen={isAddFundsModalOpen}
        onClose={() => setIsAddFundsModalOpen(false)}
        onAddFunds={handleAddFunds}
        loading={loading}
        customerPhoneNumber={customerPhoneNumber}
        setCustomerPhoneNumber={setCustomerPhoneNumber}
      />

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-4xl font-bold mb-2 sm:mb-0">
            Get Grow Up Package Hub ✨
          </h1>
          <nav className="flex items-center space-x-4 mt-4 sm:mt-0">
            {userId && (
              <span className="text-lg font-semibold">Balance: Rs. {userBalance.toFixed(2)}</span>
            )}
            {userId && (
              <button
                onClick={() => setIsAddFundsModalOpen(true)}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full shadow-md transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Add Funds
              </button>
            )}
            {userId ? (
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Logout
              </button>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-white text-gray-800 font-bold py-2 px-6 rounded-full shadow-md hover:bg-gray-100 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <div className="loading-spinner mr-2"></div>
                ) : (
                  <svg className="google-icon w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.5 12.08c0-.7-.06-1.39-.18-2.06h-9.98v3.83h5.63c-.23 1.25-.97 2.3-2.03 3.01v2.48h3.2c1.88-1.74 2.97-4.28 2.97-7.26z"></path>
                    <path fill="#34A853" d="M12.34 22c3.04 0 5.58-1 7.44-2.71l-3.2-2.48c-.89.62-2.04.99-3.24.99-2.51 0-4.63-1.69-5.38-3.95H3.64v2.53C5.74 20.37 8.84 22 12.34 22z"></path>
                    <path fill="#FBBC05" d="M7.03 14.15c-.24-.62-.38-1.3-.38-2.01s.14-1.39.38-2.01V7.61H3.64v2.53C3.25 11.23 3 11.89 3 12.56s.25 1.33.64 1.95V14.15z"></path>
                    <path fill="#EA4335" d="M12.34 6.8c1.67 0 3.12.72 4.09 1.69l2.84-2.84C17.92 3.86 15.38 3 12.34 3 8.84 3 5.74 4.63 3.64 7.61l3.39 2.61c.75-2.26 2.87-3.95 5.31-3.95z"></path>
                  </svg>
                )}
                {loading ? 'Logging In...' : 'Login with Google'}
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6">
        {/* Conditional Rendering: Login Page vs. Main App Content */}
        {userId && authReady ? ( // If userId exists AND auth is ready, show main app content
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
            {/* Current User Info */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 border-b pb-4">
              <h2 className="text-2xl font-semibold text-gray-800">Hello, {userEmail || 'User'}!</h2>
              {userId && (
                <p className="text-gray-700 text-md">
                  <span className="font-medium">User ID:</span> {userId}
                </p>
              )}
            </div>

            {/* Mobile Number Input */}
            <div className="mb-8 p-6 bg-green-50 rounded-lg shadow-inner">
              <h3 className="text-xl font-semibold text-green-800 mb-4 text-center">Your Mobile Number (Required for Activation)</h3>
              <input
                type="tel"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                placeholder="Enter your mobile number (e.g., +923001234567)"
                value={customerPhoneNumber}
                onChange={(e) => setCustomerPhoneNumber(e.target.value)}
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-2">
                This number will be used for package activation and fund additions.
              </p>
            </div>

            {/* Company Selection */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
              <label htmlFor="company-select" className="block text-gray-700 text-lg font-medium mb-2 sm:mb-0">
                Select Company:
              </label>
              <div className="relative w-full sm:w-auto">
                <select
                  id="company-select"
                  value={selectedCompany}
                  onChange={handleCompanyChange}
                  className="block appearance-none w-full bg-white border border-gray-300 text-gray-800 py-3 px-6 pr-10 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 cursor-pointer text-lg"
                >
                  {packagesData.map((company) => (
                    <option key={company.company} value={company.company}>
                      {company.company}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
                  <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 6.757 7.586 5.343 9z"/></svg>
                </div>
              </div>
            </div>

            {currentCompany && (
              <div className="text-center mb-8">
                <img
                  src={currentCompany.logo}
                  alt={`${currentCompany.company} Logo`}
                  className="mx-auto mb-4 rounded-lg shadow-md border-2 border-gray-100 object-contain h-20 w-40"
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/150x60/cccccc/333333?text=${currentCompany.company}`; }}
                />
                <h2 className="text-3xl font-bold text-gray-700 mb-6">
                  {currentCompany.company} Packages
                </h2>
              </div>
            )}

            {/* Packages Display */}
            <div className="flex flex-wrap justify-center -m-4">
              {currentCompany && currentCompany.packages.map((pkg) => (
                <PackageCard 
                  key={pkg.id} 
                  pkg={pkg} 
                  onActivate={handleActivatePackage} 
                  activatingPackageId={activatingPackageId} 
                  isAuthenticated={!!userId} 
                  customerPhoneNumber={customerPhoneNumber} 
                />
              ))}
            </div>

            {loading && (
              <div className="text-center mt-8">
                <div className="loading-spinner mx-auto mb-2"></div>
                <p className="text-gray-600">Processing request...</p>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="mt-10 max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Recent Transactions</h2>
              {transactions.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {transactions.map((trx) => (
                    <li key={trx.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div>
                        <p className="text-lg font-medium text-gray-900">
                          {trx.paymentType === 'fund_deposit' ? 'Fund Deposit' : 'Package Activation'} of Rs. {trx.amount.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Status: <span className={`font-semibold ${trx.status === 'completed' ? 'text-green-600' : trx.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{trx.status}</span>
                        </p>
                        {trx.gatewayResponseStatus && <p className="text-sm text-gray-500">Gateway Status: {trx.gatewayResponseStatus}</p>}
                        {trx.gatewayResponseDescription && <p className="text-sm text-gray-500">Description: {trx.gatewayResponseDescription}</p>}
                        {trx.phoneNumber && <p className="text-sm text-gray-500">Phone: {trx.phoneNumber}</p>} 
                        {trx.gateway && <p className="text-sm text-gray-500">Via: {trx.gateway}</p>}
                      </div>
                      <div className="text-right text-sm text-gray-500 mt-2 sm:mt-0">
                        <p>Initiated: {trx.createdAt}</p>
                        {trx.updatedAt && trx.status !== 'pending' && <p>Updated: {trx.updatedAt}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No transactions yet.</p>
              )}
            </div>
          </div>
        ) : ( // If userId is null (not logged in) AND authReady is true, show login page
          authReady && (
            <div className="login-page max-w-4xl mx-auto my-12 bg-white rounded-2xl shadow-xl p-8 text-center">
              {/* Hero Section with Slider */}
              <section className="hero-section mb-8 relative overflow-hidden rounded-lg shadow-md bg-gradient-to-r from-blue-500 to-purple-600">
                <div className="relative h-72 w-full">
                  {heroLogos.map((logo, index) => (
                    <img
                      key={index}
                      src={logo.src}
                      alt={logo.alt}
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain h-40 w-60 p-4 bg-white rounded-lg shadow-lg transition-opacity duration-1000 ${index === currentHeroImageIndex ? 'opacity-100' : 'opacity-0'}`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col justify-center items-center p-4 bg-black bg-opacity-50 text-white">
                  <h2 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
                    Unlock Exclusive Mobile Packages!
                  </h2>
                  <p className="text-xl text-gray-200 mb-6 drop-shadow">
                    Get the best internet, call, and SMS deals from Ufone, Jazz, Zong, and Telenor, all in one place.
                  </p>
                  <p className="text-lg text-gray-300 drop-shadow">
                    Simply log in with your Google account to explore our wide range of tailored packages.
                  </p>
                </div>
              </section>
              
              <button
                onClick={handleGoogleLogin}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-md shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto mt-8"
                disabled={loading}
              >
                {loading ? (
                  <div className="loading-spinner mr-2"></div>
                ) : (
                  <svg className="google-icon w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.5 12.08c0-.7-.06-1.39-.18-2.06h-9.98v3.83h5.63c-.23 1.25-.97 2.3-2.03 3.01v2.48h3.2c1.88-1.74 2.97-4.28 2.97-7.26z"></path>
                    <path fill="#34A853" d="M12.34 22c3.04 0 5.58-1 7.44-2.71l-3.2-2.48c-.89.62-2.04.99-3.24.99-2.51 0-4.63-1.69-5.38-3.95H3.64v2.53C5.74 20.37 8.84 22 12.34 22z"></path>
                    <path fill="#FBBC05" d="M7.03 14.15c-.24-.62-.38-1.3-.38-2.01s.14-1.39.38-2.01V7.61H3.64v2.53C3.25 11.23 3 11.89 3 12.56s.25 1.33.64 1.95V14.15z"></path>
                    <path fill="#EA4335" d="M12.34 6.8c1.67 0 3.12.72 4.09 1.69l2.84-2.84C17.92 3.86 15.38 3 12.34 3 8.84 3 5.74 4.63 3.64 7.61l3.39 2.61c.75-2.26 2.87-3.95 5.31-3.95z"></path>
                  </svg>
                )}
                {loading ? 'Logging In...' : 'Login with Google'}
              </button>
            </div>
          )
        )}
      </main>

      {/* Loading Overlay */}
      {!authReady && (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex flex-col items-center justify-center z-50">
          <div className="loading-spinner mb-4"></div>
          <p className="text-lg text-gray-700">Loading application and authenticating user...</p>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white p-6 text-center mt-10 shadow-inner">
        <div className="max-w-6xl mx-auto">
          <p>&copy; 2025 Get Grow Up Package Hub. All rights reserved.</p>
          <p className="text-sm mt-2">Connecting you to the best mobile deals in Pakistan.</p>
        </div>
      </footer>
    </div>
  );
}
