// Firebase Configuration for Block Rush 2K
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAGs1axXyAS4uLyo_gWVK1fIr3W_lkDlDg",
  authDomain: "blockrush2k.kharitambe.co.za",
  databaseURL: "https://games-7b902-default-rtdb.firebaseio.com",
  projectId: "games-7b902",
  storageBucket: "games-7b902.firebasestorage.app",
  messagingSenderId: "993288391523",
  appId: "1:993288391523:web:900e74dcd736ea70642156",
  measurementId: "G-LPJJ9Q0MSR"
};

// Optional: Configuration for different environments
const FIREBASE_ENV = {
  development: {
    apiKey: "AIzaSyAGs1axXyAS4uLyo_gWVK1fIr3W_lkDlDg",
    authDomain: "blockrush2k.kharitambe.co.za",
    databaseURL: "https://games-7b902-default-rtdb.firebaseio.com",
    projectId: "games-7b902",
    storageBucket: "games-7b902.firebasestorage.app",
    messagingSenderId: "993288391523",
    appId: "1:993288391523:web:900e74dcd736ea70642156",
    measurementId: "G-LPJJ9Q0MSR"
  },
  production: {
    apiKey: "AIzaSyAGs1axXyAS4uLyo_gWVK1fIr3W_lkDlDg",
    authDomain: "blockrush2k.kharitambe.co.za",
    databaseURL: "https://games-7b902-default-rtdb.firebaseio.com",
    projectId: "games-7b902",
    storageBucket: "games-7b902.firebasestorage.app",
    messagingSenderId: "993288391523",
    appId: "1:993288391523:web:900e74dcd736ea70642156",
    measurementId: "G-LPJJ9Q0MSR"
  }
};

// Auto-detect environment or use default
function getFirebaseConfig() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('🔥 Using DEVELOPMENT Firebase config (Block Rush 2K)');
    return FIREBASE_ENV.development;
  } else if (hostname.includes('firebaseapp.com') || hostname.includes('web.app') || hostname.includes('yourdomain.com')) {
    console.log('🔥 Using PRODUCTION Firebase config (Block Rush 2K)');
    return FIREBASE_ENV.production;
  }
  return FIREBASE_CONFIG;
}

// Export the active configuration
const ACTIVE_FIREBASE_CONFIG = getFirebaseConfig();