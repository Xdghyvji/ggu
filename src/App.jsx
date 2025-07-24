import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, ShoppingCart, List, LogOut, ChevronDown, ChevronUp, User, Eye, EyeOff,
    Mail, Lock, X, CheckCircle, Clock, XCircle, RefreshCw, Wallet, Paperclip,
    AlertTriangle, Instagram, Facebook, Youtube, Twitter, MessageSquare, Music, Twitch, Linkedin,
    LifeBuoy, Send, Settings, KeyRound, Copy, Check, TrendingUp, Users, ShieldCheck, Zap, Award, Star, Globe, History, Sparkles, Rocket, Gift, Trophy, CreditCard
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    updateEmail
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    onSnapshot,
    updateDoc,
    orderBy,
    getDocs,
    where,
    Timestamp,
    writeBatch,
    serverTimestamp,
    runTransaction,
    limit
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBgjU9fzFsfx6-gv4p0WWH77_U5BPk69A0",
    authDomain: "smmp-4b3cc.firebaseapp.com",
    projectId: "smmp-4b3cc",
    storageBucket: "smmp-4b3cc.firebasestorage.app",
    messagingSenderId: "43467456148",
    appId: "1:43467456148:web:368b011abf362791edfe81",
    measurementId: "G-Y6HBHEL742"
};

// --- Cloudinary Configuration ---
const CLOUDINARY_CLOUD_NAME = "dis1ptaip";
const CLOUDINARY_UPLOAD_PRESET = "mubashir";


// --- Currency & Rate Constants ---
const CURRENCY_SYMBOL = 'Rs';
const MIN_WITHDRAWAL = 100;
const COMMISSION_RATE = 0.05; // 5%

// --- Social Media Logo Mapping ---
const SocialIcon = ({ category }) => {
    const lowerCategory = (category || '').toLowerCase();
    if (lowerCategory.includes('instagram')) return <Instagram className="h-5 w-5 mr-3 text-pink-500" />;
    if (lowerCategory.includes('facebook')) return <Facebook className="h-5 w-5 mr-3 text-blue-600" />;
    if (lowerCategory.includes('youtube')) return <Youtube className="h-5 w-5 mr-3 text-red-600" />;
    if (lowerCategory.includes('tiktok')) return <Music className="h-5 w-5 mr-3 text-black" />;
    if (lowerCategory.includes('whatsapp')) return <MessageSquare className="h-5 w-5 mr-3 text-green-500" />;
    if (lowerCategory.includes('telegram')) return <Send className="h-5 w-5 mr-3 text-sky-500" />;
    return <MessageSquare className="h-5 w-5 mr-3 text-gray-500" />;
};

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// --- Dummy logAdminAction for frontend ---
const logAdminAction = async (action, details) => {
    console.log("Log Action:", action, details);
};

// --- Theme Styles Component ---
const ThemeStyles = () => (
    <style>{`
        :root, .theme-default {
          --primary-rgb: 14 165 233; --sidebar-bg-rgb: 30 41 59; --background-rgb: 248 250 252; --card-bg-rgb: 255 255 255; --text-primary-rgb: 30 41 59; --text-secondary-rgb: 100 116 139; --border-color-rgb: 226 232 240; --input-bg-rgb: 241 245 249;
        }
        .theme-nightsky {
          --primary-rgb: 56 189 248; --sidebar-bg-rgb: 15 23 42; --background-rgb: 30 41 59; --card-bg-rgb: 51 65 85; --text-primary-rgb: 241 245 249; --text-secondary-rgb: 156 163 175; --border-color-rgb: 71 85 105; --input-bg-rgb: 71 85 105;
        }
        .theme-ocean {
            --primary-rgb: 20 184 166; --sidebar-bg-rgb: 17 94 89; --background-rgb: 240 253 250; --card-bg-rgb: 255 255 255; --text-primary-rgb: 15 118 110; --text-secondary-rgb: 64 128 128; --border-color-rgb: 204 251 241; --input-bg-rgb: 240 253 250;
        }
        .theme-volcano {
            --primary-rgb: 220 38 38; --sidebar-bg-rgb: 28 25 23; --background-rgb: 41 37 36; --card-bg-rgb: 68 64 60; --text-primary-rgb: 252 252 252; --text-secondary-rgb: 168 162 158; --border-color-rgb: 87 83 78; --input-bg-rgb: 87 83 78;
        }
        .theme-meteor {
            --primary-rgb: 99 102 241; --sidebar-bg-rgb: 23 23 23; --background-rgb: 3 7 18; --card-bg-rgb: 30 41 59; --text-primary-rgb: 224 231 255; --text-secondary-rgb: 156 163 175; --border-color-rgb: 55 65 81; --input-bg-rgb: 55 65 81;
        }
        .theme-rising {
            --primary-rgb: 245 158 11; --sidebar-bg-rgb: 68 64 60; --background-rgb: 254 252 232; --card-bg-rgb: 255 255 255; --text-primary-rgb: 68 64 60; --text-secondary-rgb: 120 113 108; --border-color-rgb: 231 229 228; --input-bg-rgb: 254 252 232;
        }
        .theme-forest {
            --primary-rgb: 22 163 74; --sidebar-bg-rgb: 21 94 53; --background-rgb: 240 253 244; --card-bg-rgb: 255 255 255; --text-primary-rgb: 21 94 53; --text-secondary-rgb: 55 65 81; --border-color-rgb: 220 252 231; --input-bg-rgb: 240 253 244;
        }
        .theme-electric {
            --primary-rgb: 250 204 21; --sidebar-bg-rgb: 23 23 23; --background-rgb: 31 31 31; --card-bg-rgb: 42 42 42; --text-primary-rgb: 250 250 250; --text-secondary-rgb: 163 163 163; --border-color-rgb: 64 64 64; --input-bg-rgb: 64 64 64;
        }
        .theme-mountain {
            --primary-rgb: 96 165 250; --sidebar-bg-rgb: 55 65 81; --background-rgb: 226 232 240; --card-bg-rgb: 255 255 255; --text-primary-rgb: 30 41 59; --text-secondary-rgb: 71 85 105; --border-color-rgb: 203 213 225; --input-bg-rgb: 241 245 249;
        }
        .theme-windy {
            --primary-rgb: 20 184 166; --sidebar-bg-rgb: 15 118 110; --background-rgb: 240 253 250; --card-bg-rgb: 255 255 255; --text-primary-rgb: 13 148 136; --text-secondary-rgb: 55 65 81; --border-color-rgb: 204 251 241; --input-bg-rgb: 240 253 250;
        }
        .bg-primary { background-color: rgb(var(--primary-rgb)); }
        .hover\\:bg-primary-hover:hover { background-color: rgb(var(--primary-rgb) / 0.8); }
        .text-primary { color: rgb(var(--primary-rgb)); }
        .border-primary { border-color: rgb(var(--primary-rgb)); }
        .ring-primary { --tw-ring-color: rgb(var(--primary-rgb)); }
        .bg-sidebar { background-color: rgb(var(--sidebar-bg-rgb)); }
        .hover\\:bg-sidebar-hover:hover { background-color: rgb(var(--sidebar-bg-rgb) / 0.8); }
        .bg-background { background-color: rgb(var(--background-rgb)); }
        .bg-card { background-color: rgb(var(--card-bg-rgb)); }
        .text-text-primary { color: rgb(var(--text-primary-rgb)); }
        .text-text-secondary { color: rgb(var(--text-secondary-rgb)); }
        .border-border-color { border-color: rgb(var(--border-color-rgb)); }
        .bg-input { background-color: rgb(var(--input-bg-rgb)); }
        .bg-background-alt { background-color: rgb(var(--background-rgb) / 0.5); }
        
        @keyframes twinkle { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
        .animate-twinkle { animation: twinkle 4s infinite; }
        @keyframes meteor { 0% { transform: translate(50vw, -50vh) scale(1); opacity: 1; } 100% { transform: translate(-50vw, 50vh) scale(0); opacity: 0; } }
        .animate-meteor { animation: meteor 5s linear infinite; }
        @keyframes ember { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-100vh) scale(0.5); opacity: 0; } }
        .animate-ember { animation: ember 6s linear infinite; }
        @keyframes rising-star { 0% { transform: translateY(50vh) scale(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(-50vh) scale(1); opacity: 0; } }
        .animate-rising-star { animation: rising-star 8s ease-in-out infinite; }
        @keyframes bubble { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-100vh) scale(1); opacity: 0; } }
        .animate-bubble { animation: bubble 10s linear infinite; }
        @keyframes leaf-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
        .animate-leaf-fall { animation: leaf-fall 12s linear infinite; }
        @keyframes zap { 0%, 100% { opacity: 0; transform: scale(0.5); } 5%, 95% { opacity: 1; transform: scale(1); } }
        .animate-zap { animation: zap 2s linear infinite; }
        @keyframes snow { 0% { transform: translateY(-10vh); opacity: 1; } 100% { transform: translateY(110vh); opacity: 0; } }
        .animate-snow { animation: snow 15s linear infinite; }
        @keyframes wind { 0% { transform: translateX(-20vw); } 100% { transform: translateX(120vw); } }
        .animate-wind { animation: wind 3s linear infinite; }
    `}</style>
);

// --- Reusable Alert Modal ---
function AlertModal({ title, message, onClose }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-border-color">
                    <h3 className="text-xl font-bold text-text-primary">{title}</h3>
                </div>
                <div className="p-6">
                    <p className="text-text-secondary">{message}</p>
                </div>
                <div className="p-4 bg-background-alt flex justify-end gap-4 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Particle Animation Component ---
const ParticleContainer = ({ effect }) => {
    const particleCount = 50;
    const particles = useMemo(() => Array.from({ length: particleCount }).map((_, i) => {
        const style = {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.random() * 10 + 5}s`
        };
        switch (effect) {
            case 'meteor':
                return <div key={i} className="absolute bg-white rounded-full animate-meteor" style={style}></div>;
            case 'volcano':
                return <div key={i} className="absolute bg-orange-500 rounded-full animate-ember" style={style}></div>;
            case 'rising':
                return <div key={i} className="absolute bg-yellow-300 rounded-full animate-rising-star" style={style}></div>;
            case 'ocean':
                return <div key={i} className="absolute bg-blue-200 rounded-full animate-bubble" style={style}></div>;
            case 'forest':
                 return <div key={i} className="absolute bg-green-300 rounded-full animate-leaf-fall" style={style}></div>;
            case 'electric':
                 return <div key={i} className="absolute bg-yellow-400 w-1 h-1 rounded-full animate-zap" style={style}></div>;
            case 'mountain':
                return <div key={i} className="absolute bg-gray-400 w-px h-px animate-snow" style={style}></div>;
            case 'windy':
                return <div key={i} className="absolute bg-gray-200 w-4 h-px animate-wind" style={style}></div>;
            default: // nightsky and default
                return <div key={i} className="absolute bg-slate-400 rounded-full animate-twinkle" style={style}></div>;
        }
    }), [effect]);

    return <div className="fixed inset-0 -z-10 opacity-50">{particles}</div>;
};


// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });

    const [page, setPage] = useState('dashboard');
    const [view, setView] = useState('landing');
    const [selectedService, setSelectedService] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [theme, setTheme] = useState('default');
    const [pageTemplates, setPageTemplates] = useState({ landing: 'default', login: 'default' });

    const showAlert = (title, message) => {
        setAlertModal({ isOpen: true, title, message });
    };

    // --- Theme Listener ---
    useEffect(() => {
        document.documentElement.className = `theme-${theme}`;
    }, [theme]);

    useEffect(() => {
        const settingsRef = doc(db, "settings", "theme");
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTheme(data.name || 'default');
                setPageTemplates({
                    landing: data.landingTemplate || 'default',
                    login: data.loginTemplate || 'default'
                });
            }
        });

        const unsubscribeAuth = onAuthStateChanged(auth, async (userAuth) => {
            if (userAuth) {
                if (userAuth.email === "admin@paksmm.com") {
                    signOut(auth);
                    setView('landing');
                    setLoading(false);
                    return;
                }
                const userRef = doc(db, "users", userAuth.uid);
                const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData({ id: docSnap.id, ...data });
                    } else {
                        const urlParams = new URLSearchParams(window.location.search);
                        const refId = urlParams.get('ref');

                        const newUserDoc = {
                            email: userAuth.email,
                            name: userAuth.displayName || 'New User',
                            balance: 0.00,
                            status: 'active',
                            createdAt: Timestamp.now(),
                            apiKey: crypto.randomUUID(),
                            timezone: 'Asia/Karachi',
                            photoURL: userAuth.photoURL || null,
                            commissionBalance: 0,
                            withdrawalMethod: null,
                            claimedRankRewards: [],
                            totalSpent: 0,
                            referredBy: refId || null
                        };
                        setDoc(userRef, newUserDoc);
                        setUserData({ id: userAuth.uid, ...newUserDoc });
                    }
                    setUser(userAuth);
                    setView('app');
                    setLoading(false);
                });
                return () => unsubscribeUser();
            } else {
                setUser(null);
                setUserData(null);
                setOrders([]);
                setView('landing');
                setLoading(false);
            }
        });
        
        return () => {
            unsubscribeSettings();
            unsubscribeAuth();
        };
    }, []);

    // --- Firestore Orders Listener ---
    useEffect(() => {
        if (user) {
            const q = query(collection(db, "users", user.uid, "orders"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setOrders(ordersData);

                const newTotalSpent = ordersData
                    .filter(o => o.status === 'Completed')
                    .reduce((sum, o) => sum + (o.charge || 0), 0);
                
                if (userData && userData.totalSpent !== newTotalSpent) {
                    const userRef = doc(db, "users", user.uid);
                    updateDoc(userRef, { totalSpent: newTotalSpent });
                }

            }, (error) => {
                console.error("Error fetching orders:", error);
            });
            return () => unsubscribe();
        }
    }, [user, userData]);

    // --- Helper Functions ---
    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return `${CURRENCY_SYMBOL}0.00`;
        return `${CURRENCY_SYMBOL}${(amount).toFixed(2)}`;
    };

    const navigateTo = (pageName) => {
        setPage(pageName);
        if (pageName !== 'newOrder') setSelectedService(null);
        setIsMobileMenuOpen(false);
    };

    const placeNewOrder = async (order) => {
        if (!user || !userData) return;

        if (userData.balance < order.charge) {
            showAlert("Order Error", "Insufficient balance to place this order.");
            return Promise.reject("Insufficient balance");
        }

        try {
            const newBalance = userData.balance - order.charge;
            await updateDoc(doc(db, "users", user.uid), { balance: newBalance });

            const newOrderRef = await addDoc(collection(db, "users", user.uid, "orders"), {
                ...order,
                orderId: `ORD-${Date.now()}`,
                status: 'Pending',
                date: new Date().toISOString().split('T')[0],
                createdAt: Timestamp.now()
            });

            await logAdminAction("ORDER_PLACED", { orderId: newOrderRef.id, userId: user.uid, serviceId: order.serviceId, charge: order.charge });
            navigateTo('orders');
            return Promise.resolve("Order placed successfully!");

        } catch (error) {
            console.error("Frontend Order Error:", error);
            showAlert("Order Error", error.message);
            return Promise.reject(error.message);
        }
    };

    const handleSelectService = (service) => {
        setSelectedService(service);
        setPage('newOrder');
    };

    const handleLogout = async () => { await signOut(auth); };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-white">Loading...</p></div>;
    }

    const renderContent = () => {
        if (!user || !userData) {
            switch (view) {
                case 'auth':
                    return <LoginPage setView={setView} showAlert={showAlert} template={pageTemplates.login}/>;
                default:
                    return <LandingPage setView={setView} template={pageTemplates.landing}/>;
            }
        }

        if (userData.status === 'blocked') {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-800 p-4">
                    <h1 className="text-2xl font-bold mb-4">Account Blocked</h1>
                    <p>Your account has been blocked by the administrator.</p>
                    <p>Please contact support for more information.</p>
                    <button onClick={handleLogout} className="mt-6 bg-red-600 text-white px-4 py-2 rounded">Logout</button>
                </div>
            )
        }

        const PageContent = () => {
            const props = { formatCurrency, user, userData, navigateTo, placeNewOrder, showAlert };
            switch (page) {
                case 'dashboard': return <Dashboard {...props} stats={{ balance: userData.balance, totalSpent: userData.totalSpent }} />;
                case 'services': return <ServicesList {...props} onOrderSelect={handleSelectService} />;
                case 'orders': return <OrdersHistory {...props} orders={orders} />;
                case 'newOrder': return <NewOrderPage {...props} service={selectedService} userBalance={userData.balance} onSubmit={placeNewOrder} onBack={() => navigateTo('services')} />;
                case 'addFunds': return <AddFundsPage {...props} />;
                case 'transactions': return <TransactionsPage {...props} />;
                case 'support': return <SupportPage {...props} />;
                case 'contact': return <ContactUsPage />;
                case 'settings': return <AccountSettingsPage {...props} />;
                case 'ranks': return <RanksPage {...props} totalSpent={userData.totalSpent} />;
                case 'invite': return <InviteAndEarnPage {...props} />;
                default: return <Dashboard {...props} stats={{ balance: userData.balance, totalSpent: userData.totalSpent }} />;
            }
        };
        
        return (
             <div className="flex min-h-screen bg-background text-text-primary">
                 <Sidebar navigateTo={navigateTo} currentPage={page} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} onLogout={handleLogout} />
                 <div className="flex-1 flex flex-col lg:ml-64">
                     <Header user={userData} onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} formatCurrency={formatCurrency} navigateTo={navigateTo} />
                     <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto"><PageContent /></main>
                     <FloatingWhatsAppButton />
                 </div>
             </div>
        );
    };

    return (
        <>
            <ThemeStyles />
            <div className={`theme-${theme}`}>
                <ParticleContainer effect={theme} />
                {alertModal.isOpen && (
                    <AlertModal
                        title={alertModal.title}
                        message={alertModal.message}
                        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
                    />
                )}
                {renderContent()}
            </div>
        </>
    );
}

// --- Landing Page ---
function LandingPage({ setView, template }) {
    const HeroSection = () => (
        <main className="flex flex-col items-center justify-center text-center px-4" style={{ minHeight: '80vh' }}>
            <h2 className="text-5xl md:text-6xl font-extrabold leading-tight mb-4 animate-fade-in-down">
                Elevate Your Social Media Presence
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mb-8 animate-fade-in-up">
                The #1 SMM Panel in Pakistan for boosting your followers, likes, and views across all major platforms. Fast, reliable, and secure.
            </p>
            <button onClick={() => setView('auth')} className="bg-sky-600 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-sky-700 transition-transform hover:scale-105 animate-bounce">
                Get Started Now
            </button>
        </main>
    );

    const FeaturesSection = () => (
         <section id="features" className="py-20 bg-slate-800/50">
            <div className="container mx-auto px-4 text-center">
                <h3 className="text-3xl font-bold mb-4">Why Choose Us?</h3>
                <p className="text-slate-400 max-w-3xl mx-auto mb-12">We are the leading SMM service provider in Pakistan, dedicated to helping you achieve your social media goals with top-tier services and unbeatable prices.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-6 bg-slate-900 rounded-lg"><TrendingUp className="mx-auto h-12 w-12 text-sky-500 mb-4" /><h3 className="text-xl font-bold mb-2">Fast Growth</h3><p className="text-slate-400">See results in minutes, not days. Our services are designed for rapid delivery and impact.</p></div>
                    <div className="p-6 bg-slate-900 rounded-lg"><Users className="mx-auto h-12 w-12 text-sky-500 mb-4" /><h3 className="text-xl font-bold mb-2">Real Users</h3><p className="text-slate-400">We provide high-quality engagement from real-looking profiles to ensure authenticity.</p></div>
                    <div className="p-6 bg-slate-900 rounded-lg"><ShieldCheck className="mx-auto h-12 w-12 text-sky-500 mb-4" /><h3 className="text-xl font-bold mb-2">Secure Payments</h3><p className="text-slate-400">Your payments are secure with multiple local options like Easypaisa and JazzCash.</p></div>
                </div>
            </div>
        </section>
    );

    const ServicesSection = () => (
        <section id="services" className="py-20">
            <div className="container mx-auto px-4 text-center">
                <h3 className="text-3xl font-bold mb-4">Our Services</h3>
                <p className="text-slate-400 max-w-3xl mx-auto mb-12">We cover all major social media platforms to ensure your brand gets the visibility it deserves.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 text-slate-300">
                    <div className="flex flex-col items-center p-4"><Instagram size={40} className="mb-2" /><span>Instagram</span></div>
                    <div className="flex flex-col items-center p-4"><Facebook size={40} className="mb-2" /><span>Facebook</span></div>
                    <div className="flex flex-col items-center p-4"><Youtube size={40} className="mb-2" /><span>YouTube</span></div>
                    <div className="flex flex-col items-center p-4"><Music size={40} className="mb-2" /><span>TikTok</span></div>
                    <div className="flex flex-col items-center p-4"><MessageSquare size={40} className="mb-2" /><span>WhatsApp</span></div>
                    <div className="flex flex-col items-center p-4"><Send size={40} className="mb-2" /><span>Telegram</span></div>
                </div>
            </div>
        </section>
    );

    const Footer = () => (
         <footer className="bg-slate-900 py-8 border-t border-slate-800">
            <div className="container mx-auto px-4 text-center text-slate-400">
                <div className="flex justify-center gap-6 mb-4">
                    <a href="#" className="hover:text-white"><Instagram /></a>
                    <a href="#" className="hover:text-white"><Facebook /></a>
                    <a href="#" className="hover:text-white"><Youtube /></a>
                    <a href="#" className="hover:text-white"><Twitter /></a>
                </div>
                <div className="flex justify-center gap-4 text-sm mb-4">
                    <button onClick={() => setView('about')} className="hover:text-white">About Us</button>
                    <span>|</span>
                    <button onClick={() => setView('privacy')} className="hover:text-white">Privacy Policy</button>
                    <span>|</span>
                    <button onClick={() => setView('disclaimer')} className="hover:text-white">Disclaimer</button>
                </div>
                <p>&copy; {new Date().getFullYear()} GET GROW UP SMM Panel. All Rights Reserved.</p>
            </div>
        </footer>
    );
    
    const LandingHeader = () => (
         <header className="p-4 flex justify-between items-center container mx-auto">
            <h1 className="text-xl font-bold">GET GROW UP SMM PANEL</h1>
            <div>
                <button onClick={() => setView('auth')} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-800">Login</button>
                <button onClick={() => setView('auth')} className="ml-2 px-4 py-2 text-sm font-semibold rounded-md bg-sky-600 hover:bg-sky-700">Sign Up</button>
            </div>
        </header>
    );

    switch (template) {
        case 'minimal':
            return (
                <div className="min-h-screen bg-white text-gray-800 font-sans">
                    <header className="p-6 flex justify-between items-center container mx-auto border-b">
                        <h1 className="text-2xl font-bold text-gray-800">GET GROW UP</h1>
                        <div>
                             <button onClick={() => setView('auth')} className="px-5 py-2 text-sm font-semibold rounded-md text-gray-700 hover:bg-gray-100">Login</button>
                            <button onClick={() => setView('auth')} className="ml-2 px-5 py-2 text-sm font-semibold rounded-md bg-gray-800 text-white hover:bg-gray-900">Sign Up</button>
                        </div>
                    </header>
                    <main className="flex flex-col items-center justify-center text-center px-4 py-24">
                        <h2 className="text-6xl font-bold leading-tight mb-4">Simple, Fast, Effective.</h2>
                        <p className="text-xl text-gray-600 max-w-2xl mb-8">The most straightforward SMM panel for instant social media enhancement.</p>
                        <button onClick={() => setView('auth')} className="bg-gray-800 text-white font-bold py-4 px-10 rounded-lg text-lg hover:bg-gray-900 transition-all">
                            Start Now
                        </button>
                    </main>
                </div>
            );
        case 'corporate':
            return (
                 <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
                     <header className="p-4 flex justify-between items-center container mx-auto bg-white shadow-md">
                       <h1 className="text-xl font-bold text-blue-800">GET GROW UP | Corporate</h1>
                       <div>
                             <button onClick={() => setView('auth')} className="px-4 py-2 text-sm font-semibold rounded-md text-blue-700 hover:bg-blue-50">Login</button>
                            <button onClick={() => setView('auth')} className="ml-2 px-4 py-2 text-sm font-semibold rounded-md bg-blue-700 text-white hover:bg-blue-800">Get a Quote</button>
                       </div>
                     </header>
                     <main className="container mx-auto grid md:grid-cols-2 gap-12 items-center py-20 px-4">
                         <div>
                             <h2 className="text-5xl font-extrabold leading-tight mb-4">Your Partner in Digital Growth</h2>
                             <p className="text-lg text-slate-600 max-w-xl mb-8">We provide enterprise-level SMM solutions to scale your brand's social media strategy with measurable results and dedicated support.</p>
                             <button onClick={() => setView('auth')} className="bg-blue-700 text-white font-bold py-3 px-8 rounded-md text-lg hover:bg-blue-800 transition-all">
                                 Explore Services
                             </button>
                         </div>
                         <div className="bg-blue-600 p-8 rounded-lg shadow-xl">
                             <img src="https://placehold.co/600x400/ffffff/3b82f6?text=Analytics" alt="Analytics graph" className="rounded-md"/>
                         </div>
                     </main>
                </div>
            );
        default:
            return (
                <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden">
                    <div className="absolute inset-0 z-0 opacity-50">
                        <ParticleContainer effect="default"/>
                    </div>
                    <div className="relative z-10">
                        <LandingHeader/>
                        <HeroSection/>
                        <FeaturesSection/>
                        <ServicesSection/>
                        <Footer/>
                    </div>
                </div>
            );
    }
}

// --- Content Pages ---
function StaticPage({ title, children, setView }) {
    return (
        <div className="min-h-screen bg-slate-100">
            <header className="p-4 bg-white shadow-sm flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-800">GET GROW UP SMM PANEL</h1>
                <button onClick={() => setView('landing')} className="px-4 py-2 text-sm font-semibold rounded-md hover:bg-slate-200">&larr; Back to Home</button>
            </header>
            <main className="container mx-auto p-8">
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-3xl font-bold mb-6">{title}</h2>
                    <div className="prose max-w-none">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
function AboutPage({ setView }) {
    return (
        <StaticPage title="About Us" setView={setView}>
            <p>Welcome to GET GROW UP, Pakistan's premier Social Media Marketing (SMM) panel. Our mission is to empower individuals, influencers, and businesses to achieve unparalleled growth in the digital landscape.</p>
            <p>Founded on the principles of speed, reliability, and affordability, we provide a comprehensive suite of services designed to enhance your social media presence across all major platforms. Whether you're looking to boost your followers, increase engagement, or drive views, our automated platform delivers high-quality results instantly.</p>
            <p>We believe in the power of social media to transform brands and build communities. Our team is dedicated to providing you with the tools and support you need to succeed. Join us and take the first step towards exceptional social media growth.</p>
        </StaticPage>
    );
}

function PrivacyPolicyPage({ setView }) {
    return (
        <StaticPage title="Privacy Policy" setView={setView}>
            <p>Your privacy is important to us. It is GET GROW UP's policy to respect your privacy regarding any information we may collect from you across our website.</p>
            <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
            <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
            <p>We don’t share any personally identifying information publicly or with third-parties, except when required to by law.</p>
        </StaticPage>
    );
}

function DisclaimerPage({ setView }) {
    return (
        <StaticPage title="Disclaimer" setView={setView}>
            <p>The information provided by GET GROW UP SMM panel on our website is for general informational purposes only. All information on the site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p>
            <p>Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site. Your use of the site and your reliance on any information on the site is solely at your own risk.</p>
            <p>The services provided are for promotional purposes. We do not guarantee any specific outcomes such as sales, conversions, or business growth.</p>
        </StaticPage>
    );
}


// --- Login Page Component ---
function LoginPage({ setView, showAlert, template }) {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        setError('');
        try {
            const result = await signInWithPopup(auth, provider);
            if (result.user.email === "admin@paksmm.com") {
                await signOut(auth);
                setError("Admin accounts cannot log in to the user panel.");
            }
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            setError(error.message.replace('Firebase: ', ''));
        }
    };

    const handleEmailPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (email === "admin@paksmm.com") {
            setError("Admin accounts cannot log in to the user panel. Please use the admin panel.");
            return;
        }
        try {
            if (isLoginView) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const commonForm = (
        <>
            {error && <p className="bg-red-500/50 text-white p-3 rounded-lg text-sm">{error}</p>}
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" /><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900/50 text-white p-3 pl-10 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 transition" required /></div>
                <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" /><input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 text-white p-3 pl-10 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 transition" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">{showPassword ? <EyeOff /> : <Eye />}</button></div>
                <button type="submit" className="w-full bg-sky-600 text-white font-bold py-3 rounded-lg hover:bg-sky-700 transition-transform hover:scale-105">{isLoginView ? 'Login' : 'Sign Up'}</button>
            </form>
            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div><div className="relative flex justify-center text-sm"><span className="bg-slate-800 px-2 text-slate-400">OR</span></div></div>
            <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center py-2.5 border border-slate-700 rounded-lg hover:bg-slate-800 transition"><img className="w-6 h-6 mr-3" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" />Sign in with Google</button>
            <p className="text-sm text-center text-slate-400">{isLoginView ? "Don't have an account?" : "Already have an account?"}<button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-semibold text-sky-500 hover:text-sky-400 ml-1">{isLoginView ? 'Sign Up' : 'Login'}</button></p>
        </>
    );

    switch (template) {
        case 'minimal':
            return (
                <div className="min-h-screen bg-white flex items-center justify-center p-4">
                    <div className="w-full max-w-sm">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">{isLoginView ? 'Welcome Back' : 'Create Account'}</h2>
                        <p className="text-gray-600 mb-6">Enter your details to continue.</p>
                        {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</p>}
                        <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-100 text-gray-800 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 transition" required />
                            <div className="relative"><input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-100 text-gray-800 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 transition" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff /> : <Eye />}</button></div>
                            <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition">{isLoginView ? 'Login' : 'Sign Up'}</button>
                        </form>
                        <p className="text-sm text-center text-gray-500 mt-6">{isLoginView ? "No account yet?" : "Already have an account?"}<button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-semibold text-gray-800 hover:underline ml-1">{isLoginView ? 'Sign Up' : 'Login'}</button></p>
                    </div>
                </div>
            );
        case 'corporate':
            return (
                 <div className="min-h-screen flex">
                     <div className="w-1/2 bg-cover bg-center" style={{backgroundImage: "url('https://placehold.co/1000x1200/3b82f6/ffffff?text=SMM')"}}></div>
                     <div className="w-1/2 flex items-center justify-center p-12">
                         <div className="w-full max-w-md">
                             <h1 className="text-2xl font-bold text-blue-800 mb-4">GET GROW UP</h1>
                             <h2 className="text-3xl font-bold text-gray-800 mb-2">{isLoginView ? 'Sign In to Your Account' : 'Create a New Account'}</h2>
                             <p className="text-gray-600 mb-6">Manage your social media growth strategy.</p>
                           {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</p>}
                          <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                               <input type="email" placeholder="business.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition" required />
                               <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 transition" required />
                               <button type="submit" className="w-full bg-blue-700 text-white font-bold py-3 rounded-md hover:bg-blue-800 transition">{isLoginView ? 'Sign In' : 'Create Account'}</button>
                          </form>
                          <button onClick={handleGoogleSignIn} className="w-full mt-4 flex items-center justify-center py-3 border border-gray-300 rounded-md hover:bg-gray-50 transition"><img className="w-5 h-5 mr-3" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" />Continue with Google</button>
                          <p className="text-sm text-center text-gray-500 mt-6">{isLoginView ? "Don't have an account?" : "Already have an account?"}<button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-semibold text-blue-700 hover:underline ml-1">{isLoginView ? 'Sign Up' : 'Login'}</button></p>
                         </div>
                     </div>
                 </div>
            );
        default:
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
                    <div className="absolute inset-0 z-0">
                        <ParticleContainer effect="default"/>
                    </div>
                    <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-8 space-y-6 z-10 animate-slide-in">
                        <button onClick={() => setView('landing')} className="absolute top-4 left-4 text-white hover:text-sky-400">&larr; Back to Home</button>
                        <div><h1 className="text-3xl font-bold text-white text-center">GET GROW UP</h1><p className="text-center text-slate-300 mt-2">{isLoginView ? 'Welcome Back!' : 'Create Your Account'}</p></div>
                        {commonForm}
                    </div>
                </div>
            );
    }
}

// --- Layout Components ---
function Sidebar({ navigateTo, currentPage, isMobileMenuOpen, setIsMobileMenuOpen, onLogout }) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: User },
        { id: 'addFunds', label: 'Add Funds', icon: DollarSign },
        { id: 'transactions', label: 'Transactions', icon: CreditCard },
        { id: 'services', label: 'Services', icon: List },
        { id: 'newOrder', label: 'New Order', icon: ShoppingCart },
        { id: 'orders', label: 'Order History', icon: History },
        { id: 'ranks', label: 'Ranks & Rewards', icon: Award },
        { id: 'invite', label: 'Invite & Earn', icon: Gift },
        { id: 'support', label: 'Support', icon: LifeBuoy },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'contact', label: 'Contact Us', icon: MessageSquare },
    ];
    return (
        <>
            <div className={`fixed inset-0 z-30 bg-black/60 lg:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`} onClick={() => setIsMobileMenuOpen(false)}></div>
            <aside className={`fixed top-0 left-0 h-full w-64 bg-sidebar text-white flex flex-col z-40 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0`}>
                <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.1)]"><h1 className="text-xl font-bold text-white">GET GROW UP</h1><p className="text-sm text-slate-400">SMM Panel</p></div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map(item => {
                        const targetPage = item.id;
                        const isActive = currentPage === item.id;
                        return <a href="#" key={item.id} onClick={(e) => { e.preventDefault(); navigateTo(targetPage); }} className={`flex items-center px-4 py-3 rounded-md transition-colors duration-200 ${isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-sidebar-hover'}`}><item.icon className="h-5 w-5 mr-3" /><span>{item.label}</span></a>;
                    })}
                </nav>
                <div className="p-4 border-t border-[rgba(255,255,255,0.1)]"><a href="#" onClick={onLogout} className="flex items-center px-4 py-3 text-gray-300 hover:bg-sidebar-hover rounded-md"><LogOut className="h-5 w-5 mr-3" /><span>Logout</span></a></div>
            </aside>
        </>
    );
}

function Header({ user, onMenuClick, formatCurrency, navigateTo }) {
    return (
        <header className="bg-card p-4 flex justify-between items-center lg:justify-end border-b border-border-color shadow-sm">
            <button onClick={onMenuClick} className="lg:hidden text-text-secondary hover:text-primary"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg></button>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="flex items-center text-sm font-semibold text-green-600 bg-green-100 px-3 py-1.5 rounded-full">
                    <span>{formatCurrency(user?.balance)}</span>
                </div>
                <button onClick={() => navigateTo('addFunds')} className="hidden sm:flex items-center text-sm font-semibold text-white bg-primary hover:opacity-80 px-3 py-1.5 rounded-full transition">
                    <span className="mr-2">{CURRENCY_SYMBOL}</span>
                    <span>Add Funds</span>
                </button>
                <div className="flex items-center space-x-2">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="hidden sm:block">
                        <p className="font-semibold text-text-primary text-sm">{user?.name}</p>
                        <p className="text-xs text-text-secondary">{user?.email}</p>
                    </div>
                    <button onClick={() => navigateTo('settings')} className="text-text-secondary hover:text-primary p-2 rounded-full"><Settings size={20} /></button>
                </div>
            </div>
        </header>
    );
}

function FloatingWhatsAppButton() {
    const phoneNumber = "923701722964";
    const message = "Hello, I need help with my SMM panel account.";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    return (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 z-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
        </a>
    )
}

// --- Automated Payment Gateway Component ---
function AutomatedPaymentGateway({ user, showAlert }) {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // This URL points to your Netlify Function, using the proxy rule from netlify.toml
    const NETLIFY_FUNCTION_URL = '/api/createPaymentSession';

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const paymentAmount = parseFloat(amount);

        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        if (paymentAmount < 10) {
            setError('Minimum deposit amount is Rs 10.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(NETLIFY_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: paymentAmount,
                    userId: user.uid,
                    userEmail: user.email,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create payment session. Please contact support.');
            }

            const session = await response.json();

            if (session.paymentUrl) {
                window.location.href = session.paymentUrl;
            } else {
                throw new Error('Could not retrieve payment URL.');
            }

        } catch (err) {
            console.error("Payment initiation failed:", err);
            setError(err.message);
            showAlert("Payment Error", err.message);
            setLoading(false);
        }
    };

    return (
        <div className="bg-card p-6 rounded-lg shadow-md border border-primary/20">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Automatic Payment</h2>
            <p className="text-text-secondary mb-4">
                Add funds instantly using our secure payment gateway.
            </p>
            
            <div className="my-4 flex justify-center items-center p-4 bg-background-alt rounded-lg">
                <img src="https://placehold.co/150x50/ffffff/000000?text=Workuo+Pay" alt="Workuo Pay Logo" className="h-10" />
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-6 space-y-4">
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-text-primary mb-1">
                        Amount ({CURRENCY_SYMBOL})
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            id="amount"
                            name="amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 pl-4 border border-border-color rounded-lg bg-input focus:ring-2 focus:ring-primary transition"
                            placeholder="e.g., 1000"
                            required
                            min="10"
                        />
                    </div>
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-hover transition disabled:bg-slate-400"
                >
                    {loading ? (
                        <>
                            <RefreshCw className="animate-spin h-5 w-5" />
                            Processing...
                        </>
                    ) : (
                        'Proceed to Payment'
                    )}
                </button>
            </form>
        </div>
    );
}
