/**
 * Nexus CRM - Hybrid Storage Manager
 * Seamlessly manages Google Cloud Firestore with zero-friction local fallback.
 * Rich Activity Timeline, Tasks & Loss Reasons Support.
 */

import { STORAGE_KEYS, getSavedFirebaseConfig } from './config.js';
import * as firestoreService from './firebase-service.js';

// Realistic seed dataset with rich timeline activities, tasks and expected closing dates
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
    expectedCloseDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-1-1',
        type: 'note',
        title: 'Lead Recebido via Inbound',
        text: 'Preencheu formulário no site solicitando orçamento para volumetria alta.',
        author: 'Sistema',
        timestamp: new Date(Date.now() - 4 * 86400000).toISOString()
      },
      {
        id: 'act-1-2',
        type: 'whatsapp',
        title: 'Mensagem de Apresentação Enviada',
        text: 'Enviada apresentação institucional via WhatsApp. Aguardando retorno.',
        author: 'Você',
        timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ],
    tasks: [
      {
        id: 'task-1-1',
        title: 'Follow-up de Apresentação via WhatsApp',
        type: 'whatsapp',
        dueDate: new Date().toISOString().split('T')[0], // Today
        completed: false
      }
    ]
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
    expectedCloseDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    // 4 days idle to demonstrate Deal Rotting alert
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-2-1',
        type: 'call',
        title: 'Ligação de Qualificação',
        text: 'Conversamos por 20 minutos. Rodrigo tem autonomia de compra para Q4.',
        author: 'Você',
        timestamp: new Date(Date.now() - 4 * 86400000).toISOString()
      }
    ],
    tasks: [
      {
        id: 'task-2-1',
        title: 'Ligar para reagendar reunião técnica',
        type: 'call',
        dueDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
        completed: false
      }
    ]
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
    expectedCloseDate: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-3-1',
        type: 'meeting',
        title: 'Demonstração da Solução',
        text: 'Apresentação remota de 45 minutos. Comitê de TI participou e validou conformidade com LGPD.',
        author: 'Você',
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: 'act-3-2',
        type: 'note',
        title: 'Proposta Enviada',
        text: 'Minuta comercial enviada com opção de pagamento semestral.',
        author: 'Você',
        timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ],
    tasks: [
      {
        id: 'task-3-1',
        title: 'Cobrança do retorno da proposta com Camila',
        type: 'meeting',
        dueDate: new Date().toISOString().split('T')[0],
        completed: false
      }
    ]
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
    expectedCloseDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-4-1',
        type: 'meeting',
        title: 'Reunião de Negociação Contratual',
        text: 'Jurídico da AgroTech solicitou adequação de cláusula de rescisão sem multa em 60 dias.',
        author: 'Você',
        timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ],
    tasks: [
      {
        id: 'task-4-1',
        title: 'Enviar minuta revisada com cláusula jurídica',
        type: 'followup',
        dueDate: new Date().toISOString().split('T')[0],
        completed: true
      }
    ]
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
    expectedCloseDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-5-1',
        type: 'stage_change',
        title: 'Contrato Fechado Ganho 🎉',
        text: 'Negócio fechado e assinado via DocuSign no valor de R$ 95.000.',
        author: 'Você',
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ],
    tasks: []
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
    lossReason: 'price',
    lossDetails: 'Optaram por adiar o projeto para o próximo ano devido ao corte de CAPEX no varejo.',
    lostAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    notes: 'Optaram por adiar o projeto para o próximo trimestre por restrição orçamentária.',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    activities: [
      {
        id: 'act-6-1',
        type: 'loss',
        title: 'Oportunidade Perdida',
        text: 'Motivo: Preço / Orçamento insuficiente. Recontatar em Janeiro.',
        author: 'Você',
        timestamp: new Date(Date.now() - 5 * 86400000).toISOString()
      }
    ],
    tasks: []
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
        // Ensure activities and tasks arrays exist
        this.currentData.forEach(c => {
          if (!Array.isArray(c.activities)) c.activities = [];
          if (!Array.isArray(c.tasks)) c.tasks = [];
        });
      } else {
        this.currentData = JSON.parse(JSON.stringify(INITIAL_DEMO_LEADS));
        this.saveLocalData();
      }
    } catch (e) {
      this.currentData = JSON.parse(JSON.stringify(INITIAL_DEMO_LEADS));
    }
  }

  saveLocalData() {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify(this.currentData));
    } catch (e) {
      console.error("Error saving local data:", e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
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

  getCustomers() {
    return [...this.currentData];
  }

  getCustomer(id) {
    return this.currentData.find(c => c.id === id) || null;
  }

  /**
   * Creates or updates a customer
   */
  async saveCustomer(customerData) {
    if (customerData.id && !customerData.id.startsWith('temp-')) {
      const existing = this.getCustomer(customerData.id);
      const merged = {
        ...existing,
        ...customerData,
        activities: customerData.activities || (existing ? existing.activities : []) || [],
        tasks: customerData.tasks || (existing ? existing.tasks : []) || [],
        updatedAt: new Date().toISOString()
      };

      if (this.mode === 'firestore') {
        await firestoreService.updateFirestoreCustomer(customerData.id, merged);
      } else {
        const index = this.currentData.findIndex(c => c.id === customerData.id);
        if (index !== -1) {
          this.currentData[index] = merged;
          this.saveLocalData();
          this.notifyListeners();
        }
      }
    } else {
      const newLead = {
        activities: [],
        tasks: [],
        ...customerData,
        id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add creation activity
      newLead.activities.push({
        id: 'act-' + Date.now(),
        type: 'note',
        title: 'Oportunidade Criada',
        text: `Lead cadastrado com valor de R$ ${Number(newLead.dealValue || 0).toLocaleString('pt-BR')}.`,
        author: 'Você',
        timestamp: new Date().toISOString()
      });

      if (this.mode === 'firestore') {
        await firestoreService.addFirestoreCustomer(newLead);
      } else {
        this.currentData.unshift(newLead);
        this.saveLocalData();
        this.notifyListeners();
      }
    }
  }

  /**
   * Updates only the stage of a customer
   */
  async updateStage(customerId, newStage) {
    const customer = this.getCustomer(customerId);
    const oldStage = customer ? customer.stage : 'lead';
    const updatedAt = new Date().toISOString();

    const activity = {
      id: 'act-' + Date.now(),
      type: 'stage_change',
      title: 'Mudança de Estágio',
      text: `Oportunidade movida de "${oldStage}" para "${newStage}".`,
      author: 'Você',
      timestamp: updatedAt
    };

    if (this.mode === 'firestore') {
      const updatedActivities = customer && customer.activities ? [...customer.activities, activity] : [activity];
      await firestoreService.updateFirestoreCustomer(customerId, { 
        stage: newStage, 
        updatedAt,
        activities: updatedActivities 
      });
    } else {
      if (customer) {
        customer.stage = newStage;
        customer.updatedAt = updatedAt;
        if (!Array.isArray(customer.activities)) customer.activities = [];
        customer.activities.push(activity);
        this.saveLocalData();
        this.notifyListeners();
      }
    }
  }

  /**
   * Saves loss reason when moving to lost
   */
  async setLossReason(customerId, lossReason, lossDetails) {
    const updatedAt = new Date().toISOString();
    const activity = {
      id: 'act-' + Date.now(),
      type: 'loss',
      title: 'Oportunidade Marcada como Perdida',
      text: `Motivo: ${lossReason}. ${lossDetails ? 'Detalhes: ' + lossDetails : ''}`,
      author: 'Você',
      timestamp: updatedAt
    };

    if (this.mode === 'firestore') {
      const customer = this.getCustomer(customerId);
      const updatedActivities = customer && customer.activities ? [...customer.activities, activity] : [activity];
      await firestoreService.updateFirestoreCustomer(customerId, {
        stage: 'lost',
        lossReason,
        lossDetails: lossDetails || '',
        lostAt: updatedAt,
        updatedAt,
        activities: updatedActivities
      });
    } else {
      const customer = this.getCustomer(customerId);
      if (customer) {
        customer.stage = 'lost';
        customer.lossReason = lossReason;
        customer.lossDetails = lossDetails || '';
        customer.lostAt = updatedAt;
        customer.updatedAt = updatedAt;
        if (!Array.isArray(customer.activities)) customer.activities = [];
        customer.activities.push(activity);
        this.saveLocalData();
        this.notifyListeners();
      }
    }
  }

  /**
   * Adds an activity to a customer's timeline
   */
  async addActivity(customerId, activityData) {
    const customer = this.getCustomer(customerId);
    if (!customer) return;

    const activity = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      author: 'Você',
      ...activityData
    };

    const updatedAt = new Date().toISOString();

    if (this.mode === 'firestore') {
      const updatedActivities = [...(customer.activities || []), activity];
      await firestoreService.updateFirestoreCustomer(customerId, {
        activities: updatedActivities,
        updatedAt
      });
    } else {
      if (!Array.isArray(customer.activities)) customer.activities = [];
      customer.activities.push(activity);
      customer.updatedAt = updatedAt;
      this.saveLocalData();
      this.notifyListeners();
    }
  }

  /**
   * Adds a task to a customer
   */
  async addTask(customerId, taskData) {
    const customer = this.getCustomer(customerId);
    if (!customer) return;

    const task = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      completed: false,
      createdAt: new Date().toISOString(),
      ...taskData
    };

    const activity = {
      id: 'act-' + Date.now(),
      type: 'task',
      title: 'Tarefa Agendada',
      text: `Agendado: ${task.title} (para ${task.dueDate || 'hoje'}).`,
      author: 'Você',
      timestamp: new Date().toISOString()
    };

    const updatedAt = new Date().toISOString();

    if (this.mode === 'firestore') {
      const updatedTasks = [...(customer.tasks || []), task];
      const updatedActivities = [...(customer.activities || []), activity];
      await firestoreService.updateFirestoreCustomer(customerId, {
        tasks: updatedTasks,
        activities: updatedActivities,
        updatedAt
      });
    } else {
      if (!Array.isArray(customer.tasks)) customer.tasks = [];
      if (!Array.isArray(customer.activities)) customer.activities = [];
      customer.tasks.push(task);
      customer.activities.push(activity);
      customer.updatedAt = updatedAt;
      this.saveLocalData();
      this.notifyListeners();
    }
  }

  /**
   * Toggles task completion status
   */
  async toggleTask(customerId, taskId) {
    const customer = this.getCustomer(customerId);
    if (!customer || !Array.isArray(customer.tasks)) return;

    const task = customer.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    const updatedAt = new Date().toISOString();

    if (this.mode === 'firestore') {
      await firestoreService.updateFirestoreCustomer(customerId, {
        tasks: customer.tasks,
        updatedAt
      });
    } else {
      customer.updatedAt = updatedAt;
      this.saveLocalData();
      this.notifyListeners();
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

    localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    await this.init();
    return true;
  }

  disconnectFirebase() {
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    this.mode = 'local';
    this.loadLocalData();
    this.notifyListeners();
  }
}

export const storage = new StorageManager();
