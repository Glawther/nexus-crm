/**
 * Nexus CRM - Hybrid Storage Manager
 * Seamlessly manages Google Cloud Firestore with zero-friction local fallback.
 */

import { STORAGE_KEYS, getSavedFirebaseConfig, isFirebaseConfigured } from './config.js';
import * as firestoreService from './firebase-service.js';

// Initial realistic seed dataset for testing and demonstration
const INITIAL_DEMO_LEADS = [
  {
    id: 'demo-lead-1',
    name: 'Ana Beatriz Lima',
    email: 'ana.lima@nubankcorp.com.br',
    phone: '+55 11 98123-4567',
    company: 'NuScale Payments',
    role: 'Head de Novos Negócios',
    stage: 'lead',
    dealValue: 65000,
    priority: 'high',
    tags: ['Fintech', 'Enterprise', 'Inbound'],
    notes: 'Interesse em integração de API para pagamento em lote.',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: 'demo-lead-2',
    name: 'Rodrigo Alcantara',
    email: 'rodrigo@vanguardlog.com',
    phone: '+55 41 99876-5432',
    company: 'Vanguard Logística',
    role: 'Diretor de Operações',
    stage: 'contact',
    dealValue: 120000,
    priority: 'high',
    tags: ['Logística', 'SLA Alto'],
    notes: 'Primeira reunião agendada para alinhamento de requisitos técnicos.',
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 'demo-lead-3',
    name: 'Camila Drummond',
    email: 'camila@orionhealth.med.br',
    phone: '+55 21 97654-3210',
    company: 'Orion Health Tech',
    role: 'CTO',
    stage: 'proposal',
    dealValue: 88000,
    priority: 'medium',
    tags: ['Saúde', 'Segurança LGPD'],
    notes: 'Proposta comercial de 12 meses enviada. Em análise pelo comitê executivo.',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: 'demo-lead-4',
    name: 'Eduardo Martins',
    email: 'eduardo@agrotechbrasil.agr.br',
    phone: '+55 19 98988-1234',
    company: 'AgroTech Brasil',
    role: 'Gerente de TI',
    stage: 'negotiation',
    dealValue: 155000,
    priority: 'high',
    tags: ['Agro', 'Cloud', 'Piloto'],
    notes: 'Negociando cláusulas de suporte 24/7 e SLA de 99.9%. Decisão nesta semana.',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: 'demo-lead-5',
    name: 'Juliana Fernandes',
    email: 'juliana@solarsul.com.br',
    phone: '+55 51 99111-2233',
    company: 'SolarSul Energia',
    role: 'CEO',
    stage: 'won',
    dealValue: 95000,
    priority: 'medium',
    tags: ['Energia', 'Contrato Assinado'],
    notes: 'Contrato anual assinado! Onboarding agendado para a próxima segunda-feira.',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    id: 'demo-lead-6',
    name: 'Felipe Queiroz',
    email: 'felipe@retailsmart.com',
    phone: '+55 31 98456-7890',
    company: 'Retail Smart Varejo',
    role: 'Coordenador Comercial',
    stage: 'lost',
    dealValue: 35000,
    priority: 'low',
    tags: ['Varejo', 'Preço'],
    notes: 'Optaram por adiar o projeto para o próximo trimestre por restrição orçamentária.',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString()
  }
];

class StorageManager {
  constructor() {
    this.mode = 'local'; // 'firestore' | 'local'
    this.listeners = [];
    this.currentData = [];
    this.isInitialized = false;
  }

  /**
   * Initializes the storage engine
   */
  async init() {
    const config = getSavedFirebaseConfig();
    if (config) {
      try {
        await firestoreService.initializeFirestore(config);
        this.mode = 'firestore';
        await firestoreService.subscribeToFirestoreCustomers(
          (customers) => {
            this.currentData = customers;
            this.notifyListeners();
          },
          (err) => {
            console.warn("Falling back to local data due to Firestore error:", err);
            this.mode = 'local';
            this.loadLocalData();
            this.notifyListeners();
          }
        );
        this.isInitialized = true;
        return { mode: 'firestore', success: true };
      } catch (err) {
        console.warn("Failed to connect to Firestore on startup, using local fallback:", err);
        this.mode = 'local';
      }
    } else {
      this.mode = 'local';
    }

    this.loadLocalData();
    this.isInitialized = true;
    this.notifyListeners();
    return { mode: 'local', success: true };
  }

  /**
   * Loads or seeds local data in localStorage
   */
  loadLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DATA);
      if (raw) {
        this.currentData = JSON.parse(raw);
      } else {
        this.currentData = [...INITIAL_DEMO_LEADS];
        this.saveLocalData();
      }
    } catch (e) {
      this.currentData = [...INITIAL_DEMO_LEADS];
    }
  }

  saveLocalData() {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify(this.currentData));
    } catch (e) {
      console.error("Error saving local data:", e);
    }
  }

  /**
   * Subscribes to updates from the storage engine
   */
  subscribe(callback) {
    this.listeners.push(callback);
    // Emit initial data immediately
    if (this.currentData.length > 0) {
      callback(this.currentData, this.mode);
    }
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentData, this.mode);
      } catch (err) {
        console.error("Error in storage listener:", err);
      }
    });
  }

  /**
   * Gets current customer list
   */
  getCustomers() {
    return [...this.currentData];
  }

  /**
   * Creates or updates a customer
   */
  async saveCustomer(customerData) {
    if (customerData.id && !customerData.id.startsWith('temp-')) {
      // Update existing
      if (this.mode === 'firestore') {
        await firestoreService.updateFirestoreCustomer(customerData.id, customerData);
      } else {
        const index = this.currentData.findIndex(c => c.id === customerData.id);
        if (index !== -1) {
          this.currentData[index] = {
            ...this.currentData[index],
            ...customerData,
            updatedAt: new Date().toISOString()
          };
          this.saveLocalData();
          this.notifyListeners();
        }
      }
    } else {
      // Create new
      if (this.mode === 'firestore') {
        await firestoreService.addFirestoreCustomer(customerData);
      } else {
        const newLead = {
          ...customerData,
          id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.currentData.unshift(newLead);
        this.saveLocalData();
        this.notifyListeners();
      }
    }
  }

  /**
   * Updates only the stage of a customer (for Kanban drag/drop or stage switcher)
   */
  async updateStage(customerId, newStage) {
    if (this.mode === 'firestore') {
      await firestoreService.updateFirestoreCustomer(customerId, { stage: newStage });
    } else {
      const customer = this.currentData.find(c => c.id === customerId);
      if (customer) {
        customer.stage = newStage;
        customer.updatedAt = new Date().toISOString();
        this.saveLocalData();
        this.notifyListeners();
      }
    }
  }

  /**
   * Deletes a customer by ID
   */
  async deleteCustomer(customerId) {
    if (this.mode === 'firestore') {
      await firestoreService.deleteFirestoreCustomer(customerId);
    } else {
      this.currentData = this.currentData.filter(c => c.id !== customerId);
      this.saveLocalData();
      this.notifyListeners();
    }
  }

  /**
   * Switches to Firebase mode dynamically with new config
   */
  async connectToFirebase(config) {
    const testResult = await firestoreService.testFirestoreConnection(config);
    if (!testResult.success) {
      throw new Error(testResult.error || "Não foi possível conectar ao Firestore.");
    }

    // Save and reinitialize
    localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    await this.init();
    return true;
  }

  /**
   * Disconnects from Firebase and switches to local mode
   */
  disconnectFirebase() {
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    this.mode = 'local';
    this.loadLocalData();
    this.notifyListeners();
  }
}

export const storage = new StorageManager();
