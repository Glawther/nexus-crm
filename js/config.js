/**
 * Nexus CRM - Configuration & Firebase Credentials Storage
 */

const STORAGE_KEYS = {
  FIREBASE_CONFIG: 'nexus_crm_firebase_config',
  LOCAL_DATA: 'nexus_crm_local_customers',
  ACTIVITIES_DATA: 'nexus_crm_local_activities',
  APP_PREFS: 'nexus_crm_preferences'
};

// Default active credentials for Google Cloud Firestore (nexuscrm-d8e13)
export const defaultFirebaseConfig = {
  projectId: "nexuscrm-d8e13",
  appId: "1:723888013412:web:5197621060dd486fb41f71",
  databaseURL: "https://nexuscrm-d8e13-default-rtdb.firebaseio.com",
  storageBucket: "nexuscrm-d8e13.firebasestorage.app",
  apiKey: "AIzaSyCjJcdEhHZxUGMH2jubCqCxqBAU6kQNZIA",
  authDomain: "nexuscrm-d8e13.firebaseapp.com",
  messagingSenderId: "723888013412",
  measurementId: "G-1W84EPW08S"
};

/**
 * Retrieves the stored Firebase configuration from localStorage or environment
 */
export function getSavedFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not load stored Firebase config:", err);
  }
  return defaultFirebaseConfig;
}

/**
 * Saves Firebase configuration into localStorage
 */
export function saveFirebaseConfig(config) {
  if (!config || !config.projectId || !config.apiKey) {
    throw new Error("Configuração inválida. 'projectId' e 'apiKey' são obrigatórios.");
  }
  localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
}

/**
 * Clears stored Firebase configuration
 */
export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
}

/**
 * Checks if Firebase credentials are fully configured
 */
export function isFirebaseConfigured() {
  const config = getSavedFirebaseConfig();
  return Boolean(config && config.projectId && config.apiKey);
}

export { STORAGE_KEYS };
