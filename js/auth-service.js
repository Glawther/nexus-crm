/**
 * Nexus CRM - Google Authentication Service
 * Uses Firebase Modular SDK v11 (firebase-auth)
 */

import { getSavedFirebaseConfig } from './config.js';

let auth = null;
let currentUser = null;
const listeners = [];

const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";

async function loadAuthModules() {
  const firebaseApp = await import(FIREBASE_APP_URL);
  const firebaseAuth = await import(FIREBASE_AUTH_URL);
  return { firebaseApp, firebaseAuth };
}

/**
 * Initializes Firebase Auth with current project
 */
export async function initAuth() {
  const config = getSavedFirebaseConfig();
  if (!config) return null;

  try {
    const { firebaseApp, firebaseAuth } = await loadAuthModules();
    
    // Get existing default app or initialize
    let app;
    try {
      app = firebaseApp.getApp();
    } catch {
      app = firebaseApp.initializeApp(config);
    }

    auth = firebaseAuth.getAuth(app);

    firebaseAuth.onAuthStateChanged(auth, (user) => {
      currentUser = user ? {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Usuário',
        email: user.email,
        photoURL: user.photoURL || null
      } : null;

      notifyListeners();
    });

    return auth;
  } catch (err) {
    console.warn("Could not initialize Firebase Auth:", err);
    return null;
  }
}

/**
 * Triggers Google Sign-In via Popup
 */
export async function signInWithGoogle() {
  const config = getSavedFirebaseConfig();
  if (!config) {
    throw new Error("Conecte primeiro suas credenciais do Firebase no menu de configurações.");
  }

  const { firebaseAuth } = await loadAuthModules();
  if (!auth) await initAuth();

  const provider = new firebaseAuth.GoogleAuthProvider();
  const result = await firebaseAuth.signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Signs out current user
 */
export async function signOutUser() {
  if (auth) {
    const { firebaseAuth } = await loadAuthModules();
    await firebaseAuth.signOut(auth);
  }
  currentUser = null;
  notifyListeners();
}

/**
 * Subscribes to user authentication state
 */
export function onAuthChange(callback) {
  listeners.push(callback);
  callback(currentUser);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb(currentUser);
    } catch (e) {
      console.error("Error in auth listener:", e);
    }
  });
}

export function getCurrentUser() {
  return currentUser;
}
