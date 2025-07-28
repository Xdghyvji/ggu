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

// --- Currency & Rate Constants ---
const CURRENCY_SYMBOL = 'Rs';
const MIN_WITHDRAWAL = 100;
const COMMISSION_RATE = 0.05; // 5%
const STALE_TRANSACTION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

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

// --- Automated Payment Gateway Component (CORRECTED) ---
function AutomatedPaymentGateway({ user, showAlert }) {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const paymentAmount = parseFloat(amount);

        if (isNaN(paymentAmount) || paymentAmount < 1) {
            setError('Minimum deposit is Rs1.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = await user.getIdToken();
            
            // **BUG FIX & VERIFICATION:** Ensure this URL is correct and log it.
            const functionUrl = '/.netlify/functions/createPaymentSession';
            console.log(`Calling Netlify function: ${functionUrl}`);

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: paymentAmount }),
            });

            if (!response.ok) {
                // Try to parse the error as JSON, but have a fallback.
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    // If the response is not JSON, use the status text.
                    throw new Error(response.statusText || 'Failed to create payment session.');
                }
                throw new Error(errorData.error || 'An unknown error occurred.');
            }

            const { paymentUrl } = await response.json();

            if (paymentUrl) {
                window.location.href = paymentUrl;
            } else {
                throw new Error('Could not retrieve payment URL.');
            }

        } catch (err) {
            console.error("Payment initiation failed:", err);
            const errorMessage = err.message || "Failed to create payment session. Please contact support.";
            setError(errorMessage);
            showAlert("Payment Error", errorMessage);
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
                <img src="https://workuppay.co/assets/images/logo_icon/logo_dark.png" alt="Workup Pay Logo" className="h-10" />
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
                            min="1"
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


// --- Add Funds Page ---
function AddFundsPage({ user, userData, showAlert }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loadingMethods, setLoadingMethods] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoadingMethods(true);
        setError(null);
        const methodsQuery = query(collection(db, "payment_methods"));
        const unsubscribe = onSnapshot(methodsQuery, (snapshot) => {
            const allMethods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const activeMethods = allMethods.filter(method => method.status === 'active');
            setPaymentMethods(activeMethods);
            setLoadingMethods(false);
        }, (err) => {
            console.error("Error fetching payment methods:", err);
            setError("Could not load payment methods. Please try again later.");
            setLoadingMethods(false);
        });
        return () => unsubscribe();
    }, []);

    const openPaymentModal = (method) => {
        setPaymentMethod(method);
        setModalOpen(true);
    };

    const handleRequestSubmit = async (requestData) => {
        if (!user) return;
        
        try {
            await runTransaction(db, async (transaction) => {
                const trxIdRef = doc(db, "used_transaction_ids", requestData.trxId);
                const trxIdDoc = await transaction.get(trxIdRef);

                if (trxIdDoc.exists()) {
                    throw new Error("This Transaction ID has already been used. Please check the ID and try again.");
                }

                const fundRequestRef = doc(collection(db, "users", user.uid, "fund_requests"));
                transaction.set(fundRequestRef, {
                    ...requestData,
                    userEmail: user.email,
                    status: 'pending',
                    date: new Date().toISOString()
                });
                
                transaction.set(trxIdRef, { 
                    userId: user.uid, 
                    usedAt: serverTimestamp() 
                });
            });

            setModalOpen(false);
            showAlert("Request Submitted", "Your fund request has been submitted successfully and is pending review.");
        } catch (err) {
            console.error("Error submitting fund request:", err);
            showAlert("Error", err.message || "There was an error submitting your request. Please try again.");
        }
    };

    return (
        <div className="space-y-8">
            <AutomatedPaymentGateway user={user} showAlert={showAlert} />

            <div className="bg-card p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-text-primary mb-2">Manual Payment Methods</h2>
                <p className="text-text-secondary">Select a payment method to add funds to your account. All payments are processed manually.</p>
                
                {loadingMethods ? (
                    <div className="text-center py-10 text-text-secondary">Loading payment methods...</div>
                ) : error ? (
                    <div className="text-center py-10 bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                        {paymentMethods.map(method => (
                            <button key={method.id} onClick={() => openPaymentModal(method)} className="p-8 bg-card rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center justify-center h-48 border border-border-color">
                                <img
                                    src={method.logoUrl || `https://placehold.co/150x60/f0f0f0/333?text=${method.name}`}
                                    alt={`${method.name} logo`}
                                    className="h-20 w-full object-contain"
                                />
                                <p className="text-text-secondary mt-4 text-sm">Click to pay with {method.name}</p>
                            </button>
                        ))}
                        {paymentMethods.length === 0 && !loadingMethods && <p className="text-center py-4 text-text-secondary md:col-span-2">No manual payment methods are available at the moment.</p>}
                    </div>
                )}
            </div>
            {modalOpen && <PaymentModal user={user} method={paymentMethod} onClose={() => setModalOpen(false)} onSubmit={handleRequestSubmit} />}
        </div>
    );
}


function PaymentModal({ user, method, onClose, onSubmit }) {
    const [amount, setAmount] = useState('');
    const [trxId, setTrxId] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setFileError('File size cannot exceed 5MB.');
                setReceiptFile(null);
            } else {
                setFileError('');
                setReceiptFile(file);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !trxId || fileError || isSubmitting) return;
        setIsSubmitting(true);

        let receiptURL = null;

        if (receiptFile) {
            const formData = new FormData();
            formData.append('file', receiptFile);
            formData.append('upload_preset', "mubashir"); // Use your Cloudinary upload preset

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/dis1ptaip/image/upload`, { // Use your Cloudinary cloud name
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                if (data.secure_url) {
                    receiptURL = data.secure_url;
                } else {
                    throw new Error(data.error.message || 'Cloudinary upload failed.');
                }
            } catch (error) {
                console.error("Error uploading receipt:", error);
                setFileError("Failed to upload receipt. Please try again.");
                setIsSubmitting(false);
                return;
            }
        }

        onSubmit({ amount, trxId, method: method.name, receiptURL });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-border-color flex justify-between items-center"><h3 className="text-xl font-bold text-text-primary">Pay with {method.name}</h3><button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X /></button></div>
                <div className="p-6 space-y-4">
                    <p className="text-text-secondary text-sm">Please send your payment to the following account details, then submit the form below.</p>
                    <div className="bg-background-alt p-4 rounded-lg space-y-2">
                        <div><span className="font-semibold text-text-primary">Account Name:</span> <span className="text-text-secondary">{method.accountName}</span></div>
                        <div><span className="font-semibold text-text-primary">Account Number:</span> <span className="text-text-secondary">{method.accountNumber}</span></div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold p-3 rounded-lg">
                        <p>Funds will be processed within 24 hours. If your balance is not updated after this time, please contact our support team.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div><label className="block text-sm font-medium text-text-primary mb-1">Amount ({CURRENCY_SYMBOL})</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 border border-border-color rounded-lg bg-input" placeholder="e.g., 1000" required /></div>
                        <div><label className="block text-sm font-medium text-text-primary mb-1">Transaction ID (TID/TRX ID)</label><input type="text" value={trxId} onChange={(e) => setTrxId(e.target.value)} className="w-full p-2 border border-border-color rounded-lg bg-input" placeholder="Enter the ID from your receipt" required /></div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary mb-1">Payment Receipt (Optional)</label>
                            <input type="file" onChange={handleFileChange} accept="image/*" className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                            {fileError && <p className="text-red-500 text-xs mt-1">{fileError}</p>}
                            {receiptFile && !fileError && <p className="text-green-600 text-xs mt-1 flex items-center"><Paperclip className="h-4 w-4 mr-1" /> {receiptFile.name}</p>}
                        </div>
                        <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Cancel</button><button type="submit" disabled={isSubmitting || !!fileError} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-slate-400 flex items-center gap-2">{isSubmitting ? <><RefreshCw className="animate-spin" /> Submitting...</> : 'Submit Request'}</button></div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// --- Page Components ---

function Dashboard({ stats, formatCurrency, placeNewOrder, userData, navigateTo, showAlert }) {

    const getRank = (spent) => {
        if (spent > 50000) return { name: 'Platinum', color: 'text-cyan-400', icon: Award };
        if (spent > 10000) return { name: 'Gold', color: 'text-amber-400', icon: Star };
        if (spent > 1000) return { name: 'Silver', color: 'text-slate-400', icon: ShieldCheck };
        return { name: 'Bronze', color: 'text-orange-400', icon: Zap };
    };

    const rank = getRank(stats.totalSpent);
    const RankIcon = rank.icon;

    return (
        <div className="relative space-y-8 animate-fade-in">
            <div className="bg-card/80 backdrop-blur-sm p-6 rounded-lg shadow-lg border border-border-color/50 animate-slide-in-down">
                <h2 className="text-2xl font-bold text-text-primary">
                    Welcome back, <span className="text-primary">{userData.name}!</span>
                </h2>
                <p className="text-text-secondary">Here's your summary for today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Wallet} title="Current Balance" value={formatCurrency(stats.balance)} color="bg-green-500" />
                <StatCard icon={ShoppingCart} title="Total Spent" value={formatCurrency(stats.totalSpent)} color="bg-amber-500" />
                <div className="bg-card p-6 rounded-lg shadow-md flex items-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                    <div className={`mr-4 p-3 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900`}>
                        <RankIcon className={`h-6 w-6 ${rank.color}`} />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Your Rank</p>
                        <p className={`text-2xl font-bold ${rank.color}`}>{rank.name}</p>
                    </div>
                </div>
                <div className="bg-card p-6 rounded-lg shadow-md flex items-center animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                    <div className={`mr-4 p-3 rounded-full bg-primary`}>
                        <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Timezone</p>
                        <p className="text-2xl font-bold text-text-primary">{userData.timezone?.split('/')[1].replace('_', ' ') || 'Not Set'}</p>
                    </div>
                </div>
            </div>

            <QuickOrderBox
                userBalance={userData.balance}
                onSubmit={placeNewOrder}
                formatCurrency={formatCurrency}
                navigateTo={navigateTo}
                showAlert={showAlert}
            />

        </div>
    );
}

const StatCard = ({ icon: Icon, title, value, color }) => (<div className="bg-card p-6 rounded-lg shadow-md flex items-center animate-fade-in-up"><div className={`mr-4 p-3 rounded-full ${color}`}><Icon className="h-6 w-6 text-white" /></div><div><p className="text-sm text-text-secondary">{title}</p><p className="text-2xl font-bold text-text-primary">{value}</p></div></div>);


function QuickOrderBox({ userBalance, onSubmit, formatCurrency, navigateTo, showAlert }) {
    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedService, setSelectedService] = useState(null);
    const [link, setLink] = useState('');
    const [quantity, setQuantity] = useState('');
    const [charge, setCharge] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "categories"));
        const unsubscribe = onSnapshot(q, async (categorySnapshot) => {
            const categoriesData = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            categoriesData.sort((a, b) => a.name.localeCompare(b.name));
            setCategories(categoriesData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!selectedCategory) {
            setServices([]);
            setSelectedService(null);
            return;
        }
        setLoading(true);
        const servicesQuery = query(collection(db, `categories/${selectedCategory}/services`));
        const unsubscribe = onSnapshot(servicesQuery, (servicesSnapshot) => {
            const servicesData = servicesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            servicesData.sort((a, b) => a.name.localeCompare(b.name));
            setServices(servicesData);
            setSelectedService(null);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [selectedCategory]);

    useEffect(() => {
        if (selectedService && quantity) {
            const num = parseInt(quantity, 10);
            if (isNaN(num) || num <= 0) {
                setCharge(0);
                return;
            }
            setCharge((num / 1000) * selectedService.rate);
        } else {
            setCharge(0);
        }
    }, [quantity, selectedService]);

    const handleServiceChange = (serviceId) => {
        const service = services.find(s => s.id === serviceId);
        setSelectedService(service);
        if (service) {
            setQuantity(service.min);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        if (!selectedService) { setError('Please select a service.'); return; }

        const numQuantity = parseInt(quantity, 10);
        if (!link) { setError('Please provide a valid link.'); return; }
        if (isNaN(numQuantity) || numQuantity < selectedService.min || numQuantity > selectedService.max) {
            setError(`Quantity must be between ${selectedService.min} and ${selectedService.max}.`);
            return;
        }
        if (charge > userBalance) { setError('Insufficient balance to place this order.'); return; }

        setIsSubmitting(true);
        try {
            await onSubmit({
                serviceId: selectedService.id_api,
                serviceName: selectedService.name,
                link,
                quantity: numQuantity,
                charge
            });
            setSuccess(true);
            showAlert("Order Placed", "Your order has been placed successfully! You will be redirected shortly.");
            setTimeout(() => navigateTo('orders'), 1500);
        } catch (err) {
            setError(err.toString());
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-card p-6 rounded-lg shadow-lg relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary/10 rounded-full"></div>
            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-40 h-40 bg-pink-500/10 rounded-full"></div>
            <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2"><Rocket className="text-primary" /> Quick Order</h3>
            <form onSubmit={handleSubmit} className="space-y-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full p-2 border border-border-color rounded-lg bg-input"
                            disabled={loading}
                        >
                            <option value="">{loading ? 'Loading...' : 'Select Category'}</option>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Service</label>
                        <select
                            value={selectedService?.id || ''}
                            onChange={(e) => handleServiceChange(e.target.value)}
                            className="w-full p-2 border border-border-color rounded-lg bg-input"
                            disabled={!selectedCategory || loading}
                        >
                            <option value="">{loading ? 'Loading...' : 'Select Service'}</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                {selectedService && (
                    <div className="space-y-4 animate-fade-in">
                        <div>
                            <label htmlFor="link" className="block text-sm font-medium text-text-secondary mb-1">Link</label>
                            <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} className="w-full p-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary transition bg-input" placeholder="e.g., https://instagram.com/yourprofile" required />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="quantity" className="block text-sm font-medium text-text-secondary mb-1">Quantity</label>
                                <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary transition bg-input" placeholder={`Min: ${selectedService.min}, Max: ${selectedService.max}`} required />
                                <p className="text-xs text-text-secondary mt-1">Min: ${selectedService.min} / Max: ${selectedService.max}</p>
                            </div>
                            <div className="bg-background-alt text-text-primary p-2 rounded-lg text-center flex flex-col justify-center">
                                <p className="text-sm font-medium">Total Charge</p>
                                <p className="text-2xl font-bold">{formatCurrency(charge)}</p>
                            </div>
                        </div>
                    </div>
                )}
                {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
                {success && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg flex items-center gap-2"><CheckCircle /> Order placed successfully! Redirecting...</p>}
                <button type="submit" disabled={!selectedService || isSubmitting || success} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-hover transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isSubmitting ? <><RefreshCw className="animate-spin" /> Submitting...</> : <> <Send /> Submit Order </>}
                </button>
            </form>
        </div>
    );
}


function ServicesList({ onOrderSelect, formatCurrency }) {
    const [categories, setCategories] = useState([]);
    const [openCategory, setOpenCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingServices, setLoadingServices] = useState(true);

    useEffect(() => {
        setLoadingServices(true);
        const q = query(collection(db, "categories"));
        const unsubscribe = onSnapshot(q, async (categorySnapshot) => {
            const categoriesData = [];
            for (const catDoc of categorySnapshot.docs) {
                const servicesQuery = query(collection(db, `categories/${catDoc.id}/services`));
                const servicesSnapshot = await getDocs(servicesQuery);
                const services = servicesSnapshot.docs.map(sDoc => ({ ...sDoc.data(), id: sDoc.id }));
                services.sort((a, b) => a.name.localeCompare(b.name));
                categoriesData.push({ ...catDoc.data(), id: catDoc.id, services });
            }

            categoriesData.sort((a, b) => a.name.localeCompare(b.name));

            setCategories(categoriesData);
            if (categoriesData.length > 0 && openCategory === null) {
                setOpenCategory(categoriesData[0].id);
            }
            setLoadingServices(false);
        }, (error) => {
            console.error("Error fetching services from Firestore:", error);
            setLoadingServices(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredCategories = useMemo(() => categories.map(cat => ({
        ...cat,
        services: cat.services.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.id_api || '').toString().includes(searchTerm))
    })).filter(cat => cat.services.length > 0), [categories, searchTerm]);

    const toggleCategory = (categoryId) => setOpenCategory(openCategory === categoryId ? null : categoryId);

    if (loadingServices) return <div className="text-center py-10">Loading Services...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-card p-4 rounded-lg shadow-md"><h2 className="text-xl font-bold text-text-primary mb-2">Our Services</h2><p className="text-text-secondary mb-4">Select a service to place an order. We provide the best quality in the market.</p><input type="text" placeholder="Search services by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 border border-border-color rounded-lg focus:ring-2 focus:ring-primary transition bg-input" /></div>
            <div className="space-y-3">{filteredCategories.map(category => (<div key={category.id} className="bg-card rounded-lg shadow-md overflow-hidden"><button onClick={() => toggleCategory(category.id)} className="w-full flex justify-between items-center p-4 text-left bg-background-alt hover:bg-border-color"><h3 className="font-semibold text-text-primary flex items-center"><SocialIcon category={category.name} /> {category.name}</h3>{openCategory === category.id ? <ChevronUp className="h-5 w-5 text-text-secondary" /> : <ChevronDown className="h-5 w-5 text-text-secondary" />}</button>{openCategory === category.id && (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-text-secondary"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left w-1/2">Name</th><th className="p-3 text-left">Rate / 1000</th><th className="p-3 text-left">Min/Max</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-border-color">{category.services.map(service => (<tr key={service.id}><td className="p-3 text-text-secondary">{service.id_api}</td><td className="p-3 text-text-primary font-medium">{service.name}</td><td className="p-3 text-green-600 font-semibold">{formatCurrency(service.rate)}</td><td className="p-3 text-text-secondary">{service.min} / {service.max}</td><td className="p-3 text-right"><button onClick={() => onOrderSelect(service)} className="bg-primary text-white px-4 py-1.5 rounded-full hover:bg-primary-hover text-xs font-bold transition">Order</button></td></tr>))}</tbody></table></div>)}</div>))}{filteredCategories.length === 0 && <div className="text-center py-10 bg-card rounded-lg shadow-md"><p className="text-text-secondary">No services found.</p></div>}</div>
        </div>
    );
}

function OrdersHistory({ orders, formatCurrency }) {
    return (
        <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-text-primary mb-4">Your Order History</h2>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-background-alt text-text-secondary uppercase text-xs"><tr><th className="p-3">Order ID</th><th className="p-3 w-1/3">Service</th><th className="p-3">Link</th><th className="p-3">Quantity</th><th className="p-3">Charge</th><th className="p-3">Date</th><th className="p-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-border-color">{orders.map(order => (<tr key={order.id}><td className="p-3 font-mono text-text-primary">{order.orderId}</td><td className="p-3 text-text-primary font-medium">{order.serviceName}</td><td className="p-3 text-primary truncate max-w-xs hover:underline"><a href={order.link} target="_blank" rel="noopener noreferrer">{order.link}</a></td><td className="p-3 text-text-secondary">{(order.quantity || 0).toLocaleString()}</td><td className="p-3 text-text-secondary">{formatCurrency(order.charge)}</td><td className="p-3 text-text-secondary">{order.date}</td><td className="p-3 text-center"><StatusBadge status={order.status} /></td></tr>))}</tbody></table>{orders.length === 0 && <div className="text-center py-10"><p className="text-text-secondary">You haven't placed any orders yet.</p></div>}</div>
        </div>
    );
}

// --- NEW ORDER PAGE (FIX) ---
function NewOrderPage({ service, userBalance, onSubmit, onBack, formatCurrency, showAlert }) {
    const [link, setLink] = useState('');
    const [quantity, setQuantity] = useState(service ? service.min : '');
    const [charge, setCharge] = useState(0);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (service && quantity) {
            const num = parseInt(quantity, 10);
            if (isNaN(num) || num <= 0) {
                setCharge(0);
                return;
            }
            setCharge((num / 1000) * service.rate);
        } else {
            setCharge(0);
        }
    }, [quantity, service]);

    if (!service) {
        return (
            <div className="bg-card p-6 rounded-lg shadow-md text-center">
                <h2 className="text-xl font-bold text-text-primary mb-4">No Service Selected</h2>
                <p className="text-text-secondary mb-4">Please go back to the services page and select a service to order.</p>
                <button onClick={onBack} className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-hover">
                    &larr; Back to Services
                </button>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        const numQuantity = parseInt(quantity, 10);
        if (!link) { setError('Please provide a valid link.'); return; }
        if (isNaN(numQuantity) || numQuantity < service.min || numQuantity > service.max) {
            setError(`Quantity must be between ${service.min} and ${service.max}.`);
            return;
        }
        if (charge > userBalance) { setError('Insufficient balance to place this order.'); return; }

        setIsSubmitting(true);
        try {
            await onSubmit({
                serviceId: service.id_api,
                serviceName: service.name,
                link,
                quantity: numQuantity,
                charge
            });
            setSuccess(true);
            showAlert("Order Placed", "Your order has been placed successfully! You will be redirected to your order history.");
            // The `placeNewOrder` function already handles navigation
        } catch (err) {
            setError(err.toString());
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="text-primary font-semibold hover:underline">&larr; Back to Services</button>
            <div className="bg-card p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-text-primary mb-4">Place New Order</h2>
                
                <div className="bg-background-alt p-4 rounded-lg mb-6">
                    <h3 className="font-bold text-text-primary">{service.name}</h3>
                    <p className="text-sm text-text-secondary mt-1">
                        Rate: <span className="font-semibold text-green-600">{formatCurrency(service.rate)}</span> per 1000
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                        Min: {service.min} / Max: {service.max}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="link" className="block text-sm font-medium text-text-secondary mb-1">Link</label>
                        <input type="text" id="link" value={link} onChange={(e) => setLink(e.target.value)} className="w-full p-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary transition bg-input" placeholder="e.g., https://instagram.com/yourprofile" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-text-secondary mb-1">Quantity</label>
                            <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-2 border border-border-color rounded-lg focus:ring-2 focus:ring-primary transition bg-input" placeholder={`Min: ${service.min}, Max: ${service.max}`} required />
                            <p className="text-xs text-text-secondary mt-1">Min: ${service.min} / Max: ${service.max}</p>
                        </div>
                        <div className="bg-background text-text-primary p-2 rounded-lg text-center flex flex-col justify-center">
                            <p className="text-sm font-medium">Total Charge</p>
                            <p className="text-2xl font-bold">{formatCurrency(charge)}</p>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
                    {success && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg flex items-center gap-2"><CheckCircle /> Order placed successfully! Redirecting...</p>}
                    <button type="submit" disabled={isSubmitting || success} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-hover transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {isSubmitting ? <><RefreshCw className="animate-spin" /> Placing Order...</> : <> <ShoppingCart /> Place Order </>}
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Support Page Component ---
function SupportPage({ user, showAlert }) {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            setLoading(true);
            setError(null);
            const q = query(collection(db, `users/${user.uid}/tickets`), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const ticketsData = snapshot.docs
                    .filter(doc => doc.data().createdAt && typeof doc.data().createdAt.toDate === 'function')
                    .map(doc => ({ id: doc.id, ...doc.data() }));

                setTickets(ticketsData);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching tickets:", err);
                setError("Could not fetch your tickets. Please try again later or contact support.");
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user]);

    const handleSubmitTicket = async (e) => {
        e.preventDefault();
        if (!subject || !message) return;
        setIsSubmitting(true);
        const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        
        const ticketData = {
            ticketId,
            userEmail: user.email,
            userId: user.uid,
            subject,
            message,
            status: 'Open',
            createdAt: Timestamp.now(),
            replies: []
        };

        const batch = writeBatch(db);
        const userTicketRef = doc(db, `users/${user.uid}/tickets`, ticketId);
        batch.set(userTicketRef, ticketData);

        const mainTicketRef = doc(db, "tickets", ticketId);
        batch.set(mainTicketRef, ticketData);


        try {
            await batch.commit();
            setSubject('');
            setMessage('');
            showAlert("Ticket Submitted", "Your support ticket has been submitted successfully.");
        } catch (error) {
            console.error("Error submitting ticket:", error);
            showAlert("Error", "There was an error submitting your ticket. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-card p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-text-primary mb-4">Submit a Support Ticket</h2>
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-text-secondary mb-1">Subject</label>
                        <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-2 border border-border-color rounded-lg bg-input" required />
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-text-secondary mb-1">Message</label>
                        <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows="5" className="w-full p-2 border border-border-color rounded-lg bg-input" required></textarea>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-hover transition disabled:bg-slate-400">
                        <Send className="h-5 w-5" />
                        <span>{isSubmitting ? 'Submitting...' : 'Submit Ticket'}</span>
                    </button>
                </form>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Your Ticket History</h3>
                {loading ? <p>Loading tickets...</p> : error ? <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-background-alt text-text-secondary uppercase text-xs"><tr><th className="p-3">Date</th><th className="p-3">Ticket ID</th><th className="p-3">Subject</th><th className="p-3">Status</th></tr></thead>
                            <tbody className="divide-y divide-border-color">{tickets.map(ticket => (<tr key={ticket.id}><td className="p-3 text-text-secondary">{ticket.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td><td className="p-3 font-mono text-text-primary">{ticket.ticketId}</td><td className="p-3 text-text-secondary">{ticket.subject}</td><td className="p-3"><StatusBadge status={ticket.status} /></td></tr>))}</tbody>
                        </table>
                        {tickets.length === 0 && <p className="text-center py-4 text-text-secondary">You have no support tickets.</p>}
                    </div>
                )}
            </div>
        </div>
    )
}

function ContactUsPage() {
    return (
        <div className="bg-card p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-text-primary mb-4">Contact Us</h2>
            <p className="text-text-secondary mb-8">Have a question? We're here to help! Reach out to us through any of the methods below.</p>
            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <Mail className="h-8 w-8 text-primary mt-1" />
                    <div>
                        <h3 className="font-semibold text-lg text-text-primary">Email Support</h3>
                        <p className="text-text-secondary">Send us an email for any inquiries.</p>
                        <a href="mailto:mubashirarham12@gmail.com" className="text-primary font-medium hover:underline">mubashirarham12@gmail.com</a>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 mt-1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <div>
                        <h3 className="font-semibold text-lg text-text-primary">WhatsApp</h3>
                        <p className="text-text-secondary">Chat with us directly for instant help.</p>
                        <a href="https://wa.me/923701722964" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">+92 370 1722964</a>
                    </div>
                </div>
            </div>
        </div>
    )
}

function AccountSettingsPage({ user, userData }) {
    const [activeTab, setActiveTab] = useState('profile');

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-text-primary mb-6">Account Settings</h2>
            <div className="flex border-b border-border-color mb-6">
                <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 font-semibold ${activeTab === 'profile' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}>Profile</button>
                <button onClick={() => setActiveTab('security')} className={`px-4 py-2 font-semibold ${activeTab === 'security' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}>Security</button>
            </div>
            <div className="bg-card p-8 rounded-lg shadow-md">
                {activeTab === 'profile' && <ProfileSettings user={user} userData={userData} />}
                {activeTab === 'security' && <SecuritySettings user={user} />}
            </div>
        </div>
    );
}

function ProfileSettings({ user, userData }) {
    const [name, setName] = useState(userData.name);
    const [timezone, setTimezone] = useState(userData.timezone || 'Asia/Karachi');
    const [profilePic, setProfilePic] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setUploading(true);

        let photoURL = userData.photoURL;

        if (profilePic) {
            const formData = new FormData();
            formData.append('file', profilePic);
            formData.append('upload_preset', "mubashir"); // Use your Cloudinary upload preset

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/dis1ptaip/image/upload`, { // Use your Cloudinary cloud name
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                if (data.secure_url) {
                    photoURL = data.secure_url;
                } else {
                    throw new Error(data.error.message || 'Cloudinary upload failed.');
                }
            } catch (error) {
                setMessage({ type: 'error', text: 'Failed to upload image.' });
                console.error(error);
                setUploading(false);
                return;
            }
        }

        const userRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userRef, { name, timezone, photoURL });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update profile.' });
            console.error(error);
        }
        setUploading(false);
    };

    return (
        <div>
            <h3 className="text-xl font-bold text-text-primary mb-4">Profile Information</h3>
            {message.text && <p className={`p-3 rounded-md mb-4 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</p>}
            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="flex items-center gap-4">
                    {userData.photoURL ? (
                        <img src={userData.photoURL} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center font-bold text-3xl text-slate-600">
                            {userData?.name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <label htmlFor="profilePic" className="block text-sm font-medium text-text-secondary">Profile Picture</label>
                        <input id="profilePic" type="file" onChange={(e) => setProfilePic(e.target.files[0])} accept="image/*" className="mt-1 w-full max-w-sm text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-secondary">Email Address</label>
                    <p className="text-text-secondary">{user.email}</p>
                </div>
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-text-secondary">Full Name</label>
                    <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full max-w-sm p-2 border rounded-md bg-input border-border-color" />
                </div>
                <div>
                    <label htmlFor="timezone" className="block text-sm font-medium text-text-secondary">Timezone</label>
                    <select id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} className="mt-1 w-full max-w-sm p-2 border rounded-md bg-input border-border-color">
                        <option>Asia/Karachi</option>
                        <option>America/New_York</option>
                        <option>Europe/London</option>
                        <option>Australia/Sydney</option>
                    </select>
                </div>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover disabled:bg-slate-400" disabled={uploading}>
                    {uploading ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    )
}

function SecuritySettings({ user }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '', context: '' });

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '', context: '' });
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.', context: 'password' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters long.', context: 'password' });
            return;
        }
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setMessage({ type: 'success', text: 'Password updated successfully!', context: 'password' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update password. Check your current password.', context: 'password' });
            console.error("Password change error:", error);
        }
    };

    const handleChangeEmail = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '', context: '' });
        try {
            const credential = EmailAuthProvider.credential(user.email, emailPassword);
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, newEmail);
            await updateDoc(doc(db, "users", user.uid), { email: newEmail });
            setMessage({ type: 'success', text: 'Email updated successfully! Please re-login.', context: 'email' });
            setTimeout(() => signOut(auth), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update email. Check your password.', context: 'email' });
            console.error("Email change error:", error);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
                <h3 className="text-xl font-bold text-text-primary mb-4">Change Password</h3>
                {message.context === 'password' && <p className={`p-3 rounded-md mb-4 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</p>}
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div><label htmlFor="current-pw" className="block text-sm font-medium text-text-secondary">Current Password</label><input id="current-pw" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-input border-border-color" required /></div>
                    <div><label htmlFor="new-pw" className="block text-sm font-medium text-text-secondary">New Password</label><input id="new-pw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-input border-border-color" required /></div>
                    <div><label htmlFor="confirm-pw" className="block text-sm font-medium text-text-secondary">Confirm New Password</label><input id="confirm-pw" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-input border-border-color" required /></div>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover">Update Password</button>
                </form>
            </div>
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-text-primary mb-4">Change Email</h3>
                {message.context === 'email' && <p className={`p-3 rounded-md mb-4 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</p>}
                <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div><label htmlFor="new-email" className="block text-sm font-medium text-text-secondary">New Email</label><input id="new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-input border-border-color" required /></div>
                    <div><label htmlFor="email-confirm-pw" className="block text-sm font-medium text-text-secondary">Confirm with Password</label><input id="email-confirm-pw" type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-input border-border-color" required /></div>
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover">Update Email</button>
                </form>
            </div>
        </div>
    );
}

function ApiKeySettings({ userData }) {
    const [apiKey, setApiKey] = useState(userData.apiKey || '');
    const [copied, setCopied] = useState(false);

    const regenerateApiKey = async () => {
        const newKey = crypto.randomUUID();
        const userRef = doc(db, 'users', userData.id);
        await updateDoc(userRef, { apiKey: newKey });
        setApiKey(newKey);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(apiKey).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Your API Key</h3>
            <p className="text-text-secondary mb-4">Use this key to integrate our services with your own applications or panels.</p>
            <div className="flex items-center gap-2 bg-background-alt p-2 rounded-md max-w-lg">
                <KeyRound className="text-text-secondary" />
                <input type="text" value={apiKey} readOnly className="flex-1 bg-transparent font-mono text-sm" />
                <button onClick={copyToClipboard} className="p-2 hover:bg-border-color rounded-md">
                    {copied ? <Check className="text-green-500 h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
            </div>
            <div className="mt-6">
                <button onClick={regenerateApiKey} className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md">Regenerate API Key</button>
                <p className="text-xs text-red-500 mt-2">Warning: Regenerating will disable your old key immediately.</p>
            </div>
        </div>
    );
}

// --- Ranks & Rewards Page ---
function RanksPage({ totalSpent, formatCurrency, user, userData, showAlert }) {
    const [ranks, setRanks] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const rankIcons = { Zap, ShieldCheck, Star, Award, Trophy };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const ranksQuery = query(collection(db, "public/data/ranks"), orderBy("minSpend"));
                const ranksSnapshot = await getDocs(ranksQuery);
                const ranksData = ranksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRanks(ranksData);

                const leaderboardQuery = query(collection(db, "public/data/leaderboard"), orderBy("totalSpent", "desc"), limit(10));
                const leaderboardSnapshot = await getDocs(leaderboardQuery);
                const leaderboardData = leaderboardSnapshot.docs.map(doc => doc.data());
                setLeaderboard(leaderboardData);
            } catch (err) {
                console.error("Error fetching ranks or leaderboard:", err);
                setError("Could not load ranks data. This might be a permission issue. Please ensure the admin has set up the ranks and leaderboard collections under '/public/data/'.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getCurrentRank = (spent) => {
        let currentRank = null;
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (spent >= ranks[i].minSpend) {
                currentRank = ranks[i];
                break;
            }
        }
        return currentRank;
    };

    const handleClaimReward = async (rank) => {
        const userRef = doc(db, "users", user.uid);
        try {
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) {
                    throw "User document does not exist!";
                }

                const currentData = userDoc.data();
                const claimedRewards = currentData.claimedRankRewards || [];

                if (claimedRewards.includes(rank.name)) {
                    showAlert("Already Claimed", "You have already claimed the reward for this rank.");
                    return;
                }

                const newBalance = (currentData.balance || 0) + rank.rewardAmount;
                const newClaimedRewards = [...claimedRewards, rank.name];

                transaction.update(userRef, {
                    balance: newBalance,
                    claimedRankRewards: newClaimedRewards
                });
            });
            showAlert("Reward Claimed!", `You have successfully claimed ${formatCurrency(rank.rewardAmount)} for reaching the ${rank.name} rank.`);
        } catch (error) {
            console.error("Error claiming reward: ", error);
            showAlert("Error", "There was a problem claiming your reward. Please try again.");
        }
    };

    const currentRank = getCurrentRank(totalSpent);

    if (loading) {
        return <div className="text-center py-10">Loading Ranks & Leaderboard...</div>;
    }
    
    if (error) {
        return <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-3xl font-bold text-text-primary flex items-center gap-2">
                    <Trophy className="text-primary" /> Ranks & Rewards
                </h2>
                <p className="text-text-secondary mt-2">Unlock exclusive perks and bonuses by increasing your rank. Your rank is determined by your total spending on the panel.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {ranks.map((rank) => {
                    const Icon = rankIcons[rank.icon] || Zap;
                    const isCurrentRank = currentRank && currentRank.name === rank.name;
                    const canClaim = totalSpent >= rank.minSpend && !(userData.claimedRankRewards || []).includes(rank.name);

                    return (
                        <div key={rank.name} className={`bg-card p-6 rounded-lg shadow-lg border-2 transition-all ${isCurrentRank ? 'border-primary shadow-primary/20' : 'border-border-color'}`}>
                            <div className="flex items-center gap-4 mb-4">
                                <Icon className={`w-10 h-10 ${rank.color}`} />
                                <div>
                                    <h3 className={`text-2xl font-bold ${rank.color}`}>{rank.name}</h3>
                                    <p className="text-sm text-text-secondary">Spend over {formatCurrency(rank.minSpend)}</p>
                                </div>
                            </div>
                            <ul className="space-y-2 mb-4">
                                {rank.perks.map((perk, index) => (
                                    <li key={index} className="flex items-center gap-3 text-text-secondary">
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span>{perk}</span>
                                    </li>
                                ))}
                            </ul>
                                {rank.rewardAmount > 0 && (
                                    <button
                                        onClick={() => handleClaimReward(rank)}
                                        disabled={!canClaim}
                                        className="w-full mt-4 px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed bg-green-500 hover:bg-green-600"
                                    >
                                        { (userData.claimedRankRewards || []).includes(rank.name)
                                            ? "Claimed"
                                            : `Claim ${formatCurrency(rank.rewardAmount)}`
                                        }
                                    </button>
                                )}
                            {isCurrentRank && (
                                <div className="mt-4 bg-primary/10 text-primary text-center font-bold py-2 rounded-md">
                                    Your Current Rank
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div>
               <h2 className="text-3xl font-bold text-text-primary flex items-center gap-2 mt-12">
                   <TrendingUp className="text-primary" /> Leaderboard
               </h2>
                <div className="bg-card p-6 rounded-lg shadow-md mt-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                                <thead className="text-left bg-background-alt">
                                <tr>
                                    <th className="p-3">Rank</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3 text-right">Total Spent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-color">
                                {leaderboard.map((user, index) => (
                                    <tr key={index}>
                                        <td className="p-3 font-bold text-lg text-text-secondary">{index + 1}</td>
                                        <td className="p-3 flex items-center gap-3">
                                            <img src={user.photoURL || `https://placehold.co/40x40/e2e8f0/64748b?text=${user.name.charAt(0)}`} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                                            <span className="font-semibold text-text-primary">{user.name}</span>
                                        </td>
                                        <td className="p-3 text-right font-semibold text-green-600">{formatCurrency(user.totalSpent)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Invite & Earn Page (REWRITTEN) ---
function InviteAndEarnPage({ user, userData, formatCurrency, showAlert }) {
    const [withdrawalMethod, setWithdrawalMethod] = useState(userData?.withdrawalMethod || { name: 'Easypaisa', details: '', accountName: '' });
    const [withdrawalAmount, setWithdrawalAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [referrals, setReferrals] = useState([]);
    const [loadingReferrals, setLoadingReferrals] = useState(true);

    const referralLink = `${window.location.origin}${window.location.pathname}?ref=${user.uid}`;

    useEffect(() => {
        if (!user) return;
        setLoadingReferrals(true);

        const referralsQuery = query(collection(db, "users"), where("referredBy", "==", user.uid));
        const unsubscribeReferrals = onSnapshot(referralsQuery, async (snapshot) => {
            const referredUsersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const commissionsQuery = query(collection(db, `users/${user.uid}/commissions`));
            const commissionsSnapshot = await getDocs(commissionsQuery);
            
            const commissionsByReferredUser = commissionsSnapshot.docs.reduce((acc, doc) => {
                const data = doc.data();
                acc[data.fromUserId] = (acc[data.fromUserId] || 0) + data.amount;
                return acc;
            }, {});

            const referralsWithCommission = referredUsersData.map(refUser => ({
                email: refUser.email,
                totalSpent: refUser.totalSpent || 0,
                commissionEarned: commissionsByReferredUser[refUser.id] || 0
            }));

            setReferrals(referralsWithCommission);
            setLoadingReferrals(false);
        });

        return () => {
            unsubscribeReferrals();
        };
    }, [user]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(referralLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleSaveMethod = async (e) => {
        e.preventDefault();
        const userRef = doc(db, "users", user.uid);
        try {
            await updateDoc(userRef, { withdrawalMethod });
            showAlert("Success", "Withdrawal method saved successfully!");
        } catch (error) {
            showAlert("Error", "Failed to save withdrawal method.");
            console.error("Error saving withdrawal method:", error);
        }
    };

    const handleRequestWithdrawal = async (e) => {
        e.preventDefault();
        const amount = parseFloat(withdrawalAmount);

        if (!userData.withdrawalMethod?.details || !userData.withdrawalMethod?.accountName) {
            showAlert("Withdrawal Error", "Please save a complete withdrawal method first (including account details and name).");
            return;
        }
        if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
            showAlert("Withdrawal Error", `Minimum withdrawal amount is ${formatCurrency(MIN_WITHDRAWAL)}.`);
            return;
        }
        if (amount > userData.commissionBalance) {
            showAlert("Withdrawal Error", "Withdrawal amount cannot exceed your commission balance.");
            return;
        }

        setIsSubmitting(true);
        try {
            const newBalance = (userData.commissionBalance || 0) - amount;

            const batch = writeBatch(db);

            const userRef = doc(db, "users", user.uid);
            batch.update(userRef, { commissionBalance: newBalance });

            const requestRef = doc(collection(db, "withdrawal_requests"));
            batch.set(requestRef, {
                userId: user.uid,
                userEmail: userData.email,
                amount: amount,
                withdrawalMethod: userData.withdrawalMethod,
                status: 'pending',
                date: Timestamp.now(),
            });

            await batch.commit();
            showAlert("Success", "Withdrawal request submitted successfully!");
            setWithdrawalAmount('');

        } catch (error) {
            showAlert("Error", "Failed to submit withdrawal request.");
            console.error("Error submitting withdrawal request:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-text-primary flex items-center gap-2">
                    <Gift className="text-primary" /> Invite & Earn
                </h2>
                <p className="text-text-secondary mt-2">Earn a {COMMISSION_RATE * 100}% commission on every deposit made by users you refer.</p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-md">
                <h3 className="font-bold text-lg text-text-primary mb-2">Your Referral Link</h3>
                <p className="text-sm text-text-secondary mb-4">Share this link with your friends. When they sign up and deposit funds, you'll earn a commission!</p>
                <div className="flex items-center gap-2 bg-input p-2 rounded-md">
                    <input type="text" value={referralLink} readOnly className="flex-1 bg-transparent font-mono text-sm text-text-secondary" />
                    <button onClick={handleCopyLink} className="p-2 bg-primary text-white rounded-md hover:bg-primary-hover">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-card p-6 rounded-lg shadow-md">
                        <h3 className="font-bold text-lg text-text-primary mb-2">Commission Wallet</h3>
                        <p className="text-4xl font-bold text-green-500">{formatCurrency(userData.commissionBalance || 0)}</p>
                        <p className="text-sm text-text-secondary mt-2">Available for withdrawal.</p>

                        <form onSubmit={handleRequestWithdrawal} className="mt-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Withdrawal Amount</label>
                                <input
                                    type="number"
                                    value={withdrawalAmount}
                                    onChange={e => setWithdrawalAmount(e.target.value)}
                                    className="w-full p-2 border border-border-color rounded-lg bg-input"
                                    placeholder={`Min ${MIN_WITHDRAWAL}`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || !withdrawalAmount || parseFloat(withdrawalAmount) < MIN_WITHDRAWAL || parseFloat(withdrawalAmount) > userData.commissionBalance}
                                className="w-full bg-primary text-white font-bold py-2 rounded-lg hover:bg-primary-hover disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? "Processing..." : `Request Withdrawal`}
                            </button>
                        </form>
                    </div>

                    <div className="bg-card p-6 rounded-lg shadow-md">
                        <h3 className="font-bold text-lg text-text-primary mb-2">Withdrawal Method</h3>
                        <form onSubmit={handleSaveMethod} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Method</label>
                                <select
                                    value={withdrawalMethod.name}
                                    onChange={e => setWithdrawalMethod({ ...withdrawalMethod, name: e.target.value })}
                                    className="w-full p-2 border border-border-color rounded-lg bg-input"
                                >
                                    <option>Easypaisa</option>
                                    <option>Jazzcash</option>
                                    <option>Bank Transfer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Account / IBAN</label>
                                <input
                                    type="text"
                                    value={withdrawalMethod.details}
                                    onChange={e => setWithdrawalMethod({ ...withdrawalMethod, details: e.target.value })}
                                    className="w-full p-2 border border-border-color rounded-lg bg-input"
                                    placeholder="e.g., 03001234567"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Account Name</label>
                                <input
                                    type="text"
                                    value={withdrawalMethod.accountName || ''}
                                    onChange={e => setWithdrawalMethod({ ...withdrawalMethod, accountName: e.target.value })}
                                    className="w-full p-2 border border-border-color rounded-lg bg-input"
                                    placeholder="Your full name"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-700">
                                Save Method
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-md">
                    <h3 className="font-bold text-lg text-text-primary mb-4">Your Referrals ({referrals.length})</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-background-alt text-text-secondary uppercase text-xs">
                                <tr>
                                    <th className="p-3">User Email</th>
                                    <th className="p-3">Total Spent</th>
                                    <th className="p-3">Commission Earned</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-color">
                                {loadingReferrals ? (
                                    <tr><td colSpan="3" className="text-center p-4">Loading referrals...</td></tr>
                                ) : referrals.length > 0 ? (
                                    referrals.map((ref, index) => (
                                        <tr key={index}>
                                            <td className="p-3 text-text-secondary">{ref.email}</td>
                                            <td className="p-3 text-text-secondary">{formatCurrency(ref.totalSpent)}</td>
                                            <td className="p-3 font-semibold text-green-600">{formatCurrency(ref.commissionEarned)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="3" className="text-center p-4 text-text-secondary">You have not referred any users yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- NEW Transactions Page ---
function TransactionsPage({ user, formatCurrency }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const q = query(collection(db, `users/${user.uid}/transactions`), orderBy("createdAt", "desc"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const transactionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(transactionsData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching transactions:", err);
            setError("Could not load your transaction history.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const getStatusDisplay = (status, createdAt) => {
        const now = new Date();
        const createdDate = createdAt?.toDate ? createdAt.toDate() : null;

        if (status === 'pending' && createdDate && (now.getTime() - createdDate.getTime()) > STALE_TRANSACTION_THRESHOLD_MS) {
            return 'pending_stale'; // Custom status for stale pending transactions
        }
        return status;
    };

    return (
        <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-text-primary mb-4">Transaction History</h2>
            <div className="overflow-x-auto">
                {loading ? (
                    <p className="text-center py-10 text-text-secondary">Loading transactions...</p>
                ) : error ? (
                    <p className="text-center py-10 text-red-500">{error}</p>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-background-alt text-text-secondary uppercase text-xs">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Transaction ID</th>
                                <th className="p-3">Amount</th>
                                <th className="p-3">Gateway</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color">
                            {transactions.map(tx => (
                                <tr key={tx.id}>
                                    <td className="p-3 text-text-secondary">{tx.createdAt?.toDate().toLocaleString() || 'N/A'}</td>
                                    <td className="p-3 font-mono text-text-primary">{tx.gatewayTransactionId || tx.id}</td>
                                    <td className="p-3 text-text-secondary">{formatCurrency(tx.amount)}</td>
                                    <td className="p-3 text-text-secondary">{tx.gateway || 'N/A'}</td>
                                    <td className="p-3 text-center"><StatusBadge status={getStatusDisplay(tx.status, tx.createdAt)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && transactions.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-text-secondary">You have no automated transactions yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


// --- Helper Components ---
const StatusBadge = ({ status }) => {
    const statusMap = {
        Completed: 'bg-green-100 text-green-800', completed: 'bg-green-100 text-green-800',
        Processing: 'bg-blue-100 text-blue-800',
        Pending: 'bg-yellow-100 text-yellow-800', pending: 'bg-yellow-100 text-yellow-800',
        Canceled: 'bg-red-100 text-red-800', canceled: 'bg-red-100 text-red-800',
        Partial: 'bg-purple-100 text-purple-800',
        Open: 'bg-sky-100 text-sky-800',
        Answered: 'bg-indigo-100 text-indigo-800',
        Resolved: 'bg-gray-100 text-gray-800', 'resolved': 'bg-gray-200 text-gray-800',
        rejected: 'bg-red-100 text-red-800',
        failed: 'bg-red-200 text-red-800',
        pending_stale: 'bg-orange-100 text-orange-800', // New style for stale pending
    };
    const displayText = status === 'pending_stale' ? 'Pending (Stale)' : status;
    return (<span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${statusMap[status] || 'bg-gray-100 text-gray-800'}`}>{displayText}</span>);
};

// --- NEW Confirmation Modal ---
function ConfirmationModal({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
                <div className="p-6 text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                    <h3 className="text-lg font-medium text-gray-900 mt-2">Are you sure?</h3>
                    <p className="text-sm text-gray-500 mt-2">{message}</p>
                </div>
                <div className="p-4 bg-gray-50 flex justify-center gap-4">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
