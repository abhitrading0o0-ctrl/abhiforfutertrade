// ============================================================
// ForFuture — Firebase Initialization & Configuration
// ============================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyCXDWOcIMiD9CNvTUHbAtBDk00zt5zjPwk",
  authDomain: "for-future-trade.firebaseapp.com",
  projectId: "for-future-trade",
  storageBucket: "for-future-trade.firebasestorage.app",
  messagingSenderId: "686662395945",
  appId: "1:686662395945:web:ec0b7469b8506af44fd438",
  measurementId: "G-Y29SQ0984W"
};

// Initialize Firebase instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Analytics initialization (safely checks browser & storage support)
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('[Firebase] Initialized with Analytics (for-future-trade)');
    }
  }).catch((err) => {
    console.warn('[Firebase] Analytics not supported in this environment:', err);
  });
}

export default app;
