/**
 * Nexus CRM - Configuration & Firebase Credentials Storage
 */

const STORAGE_KEYS = {
  FIREBASE_CONFIG: 'nexus_crm_firebase_config',
  LOCAL_DATA: 'nexus_crm_local_customers',
  ACTIVITIES_DATA: 'nexus_crm_local_activities',
  APP_PREFS: 'nexus_crm_preferences'
};

// Default empty config structure required by Firebase SDK
export const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
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
  return null;
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
