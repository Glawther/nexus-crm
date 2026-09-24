/**
 * Nexus CRM - Central State Store & Metrics Calculator
 * Enterprise Multi-Module State with Forecast, Loss Reasons & Activity Tracking
 */

export const STAGES = [
  { id: 'lead', name: 'Novo Lead', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'contact', name: 'Primeiro Contato', color: '#2563eb', bg: '#eff6ff' },
  { id: 'proposal', name: 'Proposta Enviada', color: '#d97706', bg: '#fffbeb' },
  { id: 'negotiation', name: 'Em Negociação', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'won', name: 'Fechado Ganho', color: '#16a34a', bg: '#f0fdf4' },
  { id: 'lost', name: 'Perdido', color: '#dc2626', bg: '#fef2f2' }
];

export const PRIORITIES = [
  { id: 'high', label: 'Alta Prioridade', color: '#e11d48' },
  { id: 'medium', label: 'Média Prioridade', color: '#d97706' },
  { id: 'low', label: 'Baixa Prioridade', color: '#16a34a' }
];

export const LOSS_REASONS = [
  { id: 'price', label: 'Preço / Orçamento insuficiente' },
  { id: 'competitor', label: 'Optou pelo Concorrente' },
  { id: 'timing', label: 'Timing / Projeto adiado' },
  { id: 'features', label: 'Falta de recursos / Produto' },
  { id: 'ghosting', label: 'Parou de responder (Ghosting)' },
  { id: 'cancelled', label: 'Iniciativa cancelada pelo cliente' },
  { id: 'other', label: 'Outro motivo' }
];

export const TASK_TYPES = [
  { id: 'call', label: 'Ligação', icon: '📞' },
  { id: 'meeting', label: 'Reunião', icon: '📅' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'followup', label: 'Follow-up', icon: '📝' }
];

class CRMStore {
  constructor() {
    this.customers = [];
    this.storageMode = 'local';
    this.searchQuery = '';
    this.selectedPriority = 'all';
    this.activeView = 'pipeline'; // 'pipeline' | 'customers' | 'tasks' | 'metrics'
    this.taskFilter = 'pending'; // 'pending' | 'today' | 'all' | 'completed'
    this.subscribers = [];
  }

  setCustomers(customers, mode = 'local') {
    this.customers = customers;
    this.storageMode = mode;
    this.emitChange();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.emitChange();
  }

  setPriorityFilter(priority) {
    this.selectedPriority = priority;
    this.emitChange();
  }

  setActiveView(view) {
    this.activeView = view;
    this.emitChange();
  }

  setTaskFilter(filter) {
    this.taskFilter = filter;
    this.emitChange();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.getState());
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  emitChange() {
    const state = this.getState();
    this.subscribers.forEach(cb => cb(state));
  }

  getState() {
    const filteredCustomers = this.customers.filter(c => {
      // Priority filter
      if (this.selectedPriority !== 'all' && c.priority !== this.selectedPriority) {
        return false;
      }
      // Search filter
      if (this.searchQuery) {
        const target = `${c.name || ''} ${c.company || ''} ${c.email || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
        return target.includes(this.searchQuery);
      }
      return true;
    });

    const metrics = this.calculateMetrics();
    const allTasks = this.extractAllTasks();

    return {
      allCustomers: this.customers,
      filteredCustomers,
      metrics,
      tasks: allTasks,
      taskFilter: this.taskFilter,
      activeView: this.activeView,
      searchQuery: this.searchQuery,
      selectedPriority: this.selectedPriority,
      storageMode: this.storageMode
    };
  }

  /**
   * Consolidates all tasks from all leads
   */
  extractAllTasks() {
    const tasks = [];
    this.customers.forEach(customer => {
      if (Array.isArray(customer.tasks)) {
        customer.tasks.forEach(t => {
          tasks.push({
            ...t,
            customerId: customer.id,
            customerName: customer.name,
            customerCompany: customer.company
          });
        });
      }
    });

    // Sort by dueDate
    return tasks.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }

  calculateMetrics() {
    let pipelineTotal = 0;
    let wonTotal = 0;
    let wonCount = 0;
    let lostCount = 0;
    let activeDealsCount = 0;
    let rottingCount = 0;

    const stageSums = {};
    const stageCounts = {};
    const lossReasonCounts = {};

    STAGES.forEach(s => {
      stageSums[s.id] = 0;
      stageCounts[s.id] = 0;
    });

    LOSS_REASONS.forEach(r => {
      lossReasonCounts[r.id] = { count: 0, label: r.label, totalValue: 0 };
    });

    const now = Date.now();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let currentMonthForecast = 0;

    this.customers.forEach(c => {
      const val = Number(c.dealValue) || 0;
      const stage = c.stage || 'lead';

      if (stageSums[stage] !== undefined) {
        stageSums[stage] += val;
        stageCounts[stage] += 1;
      }

      // Check Deal Rotting (> 3 days without update in active stage)
      if (stage !== 'won' && stage !== 'lost') {
        const updatedTime = new Date(c.updatedAt || c.createdAt || now).getTime();
        const daysIdle = (now - updatedTime) / (1000 * 60 * 60 * 24);
        if (daysIdle >= 3) {
          rottingCount++;
        }

        // Expected close forecast
        if (c.expectedCloseDate) {
          const expDate = new Date(c.expectedCloseDate);
          if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
            currentMonthForecast += val;
          }
        }
      }

      if (stage === 'won') {
        wonTotal += val;
        wonCount += 1;
      } else if (stage === 'lost') {
        lostCount += 1;
        const reasonId = c.lossReason || 'other';
        if (lossReasonCounts[reasonId]) {
          lossReasonCounts[reasonId].count += 1;
          lossReasonCounts[reasonId].totalValue += val;
        } else if (lossReasonCounts['other']) {
          lossReasonCounts['other'].count += 1;
          lossReasonCounts['other'].totalValue += val;
        }
      } else {
        pipelineTotal += val;
        activeDealsCount += 1;
      }
    });

    const totalDecided = wonCount + lostCount;
    const conversionRate = totalDecided > 0 ? ((wonCount / totalDecided) * 100).toFixed(1) : "0.0";
    const avgTicket = wonCount > 0 ? (wonTotal / wonCount) : (this.customers.length > 0 ? (pipelineTotal / this.customers.length) : 0);

    return {
      pipelineTotal,
      wonTotal,
      wonCount,
      lostCount,
      activeDealsCount,
      conversionRate,
      avgTicket,
      stageSums,
      stageCounts,
      rottingCount,
      lossReasonCounts,
      currentMonthForecast
    };
  }
}

export const crmStore = new CRMStore();
