/**
 * Nexus CRM - Google Cloud Firestore Service Layer
 * Uses official Firebase Modular SDK v11
 */

let app = null;
let db = null;
let unsubscribeCustomers = null;

const FIREBASE_SDK_URL = "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
const FIRESTORE_SDK_URL = "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/**
 * Dynamically loads the Firebase Modular SDK via ES Modules
 */
async function loadFirebaseModules() {
  const firebaseApp = await import(FIREBASE_SDK_URL);
  const firestore = await import(FIRESTORE_SDK_URL);
  return { firebaseApp, firestore };
}

/**
 * Initializes the Firebase App and Firestore instance
 * @param {Object} config - Firebase project configuration object
 */
export async function initializeFirestore(config) {
  if (!config || !config.projectId || !config.apiKey) {
    throw new Error("Credenciais do Firebase incompletas.");
  }

  const { firebaseApp, firestore } = await loadFirebaseModules();

  // If already initialized with different config, delete or recreate
  if (app) {
    try {
      if (unsubscribeCustomers) {
        unsubscribeCustomers();
        unsubscribeCustomers = null;
      }
    } catch (e) {
      console.warn("Error cleaning up previous listener:", e);
    }
  }

  app = firebaseApp.initializeApp(config, "nexus-crm-app-" + Date.now());
  db = firestore.getFirestore(app);
  return { app, db };
}

/**
 * Subscribes to real-time updates from Firestore 'customers' collection
 * @param {Function} onData - Callback when data changes
 * @param {Function} onError - Callback when error occurs
 */
export async function subscribeToFirestoreCustomers(onData, onError) {
  if (!db) {
    throw new Error("Firestore não inicializado.");
  }

  const { firestore } = await loadFirebaseModules();
  const customersCollection = firestore.collection(db, "customers");
  const q = firestore.query(customersCollection, firestore.orderBy("updatedAt", "desc"));

  unsubscribeCustomers = firestore.onSnapshot(
    q,
    (snapshot) => {
      const customers = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        customers.push({
          ...data,
          id: doc.id,
          firestoreId: doc.id
        });
      });
      onData(customers);
    },
    (err) => {
      console.error("Firestore onSnapshot error:", err);
      if (onError) onError(err);
    }
  );

  return unsubscribeCustomers;
}

/**
 * Adds a new customer document into Firestore
 */
export async function addFirestoreCustomer(customerData) {
  if (!db) throw new Error("Firestore não inicializado.");
  const { firestore } = await loadFirebaseModules();
  
  const cleanData = { ...customerData };
  if (cleanData.id && cleanData.id.startsWith('lead-')) {
    cleanData.clientLeadId = cleanData.id;
    delete cleanData.id;
  }
  delete cleanData.firestoreId;

  const payload = {
    ...cleanData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const docRef = await firestore.addDoc(firestore.collection(db, "customers"), payload);
  return { ...payload, id: docRef.id, firestoreId: docRef.id };
}

/**
 * Updates an existing customer document in Firestore
 */
export async function updateFirestoreCustomer(id, partialData) {
  if (!db) throw new Error("Firestore não inicializado.");
  const { firestore } = await loadFirebaseModules();

  const cleanData = { ...partialData };
  delete cleanData.id;
  delete cleanData.firestoreId;

  const docRef = firestore.doc(db, "customers", id);
  const payload = {
    ...cleanData,
    updatedAt: new Date().toISOString()
  };

  await firestore.updateDoc(docRef, payload);
  return { id, firestoreId: id, ...payload };
}

/**
 * Deletes a customer document from Firestore
 */
export async function deleteFirestoreCustomer(id) {
  if (!db) throw new Error("Firestore não inicializado.");
  const { firestore } = await loadFirebaseModules();

  const docRef = firestore.doc(db, "customers", id);
  await firestore.deleteDoc(docRef);
  return true;
}

/**
 * Tests connection to Firestore with provided configuration
 */
export async function testFirestoreConnection(config) {
  try {
    const { app: testApp, db: testDb } = await initializeFirestore(config);
    const { firestore } = await loadFirebaseModules();
    // Perform a lightweight read to test rules and connection
    const testCol = firestore.collection(testDb, "customers");
    const testQuery = firestore.query(testCol, firestore.limit(1));
    await firestore.getDocs(testQuery);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "Falha na conexão com o Firestore." };
  }
}
