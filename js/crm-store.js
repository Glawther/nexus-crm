/**
 * Nexus CRM - Central State Store & Metrics Calculator
 */

export const STAGES = [
  { id: 'lead', name: 'Novo Lead', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  { id: 'contact', name: 'Primeiro Contato', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { id: 'proposal', name: 'Proposta Enviada', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'negotiation', name: 'Em Negociação', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  { id: 'won', name: 'Fechado Ganho', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  { id: 'lost', name: 'Perdido', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
];

export const PRIORITIES = [
  { id: 'high', label: 'Alta Prioridade', color: '#f43f5e' },
  { id: 'medium', label: 'Média Prioridade', color: '#f59e0b' },
  { id: 'low', label: 'Baixa Prioridade', color: '#10b981' }
];

class CRMStore {
  constructor() {
    this.customers = [];
    this.storageMode = 'local';
    this.searchQuery = '';
    this.selectedPriority = 'all';
    this.activeView = 'pipeline'; // 'pipeline' | 'customers' | 'metrics'
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

    return {
      allCustomers: this.customers,
      filteredCustomers,
      metrics,
      activeView: this.activeView,
      searchQuery: this.searchQuery,
      selectedPriority: this.selectedPriority,
      storageMode: this.storageMode
    };
  }

  calculateMetrics() {
    let pipelineTotal = 0;
    let wonTotal = 0;
    let wonCount = 0;
    let lostCount = 0;
    let activeDealsCount = 0;

    const stageSums = {};
    const stageCounts = {};

    STAGES.forEach(s => {
      stageSums[s.id] = 0;
      stageCounts[s.id] = 0;
    });

    this.customers.forEach(c => {
      const val = Number(c.dealValue) || 0;
      const stage = c.stage || 'lead';

      if (stageSums[stage] !== undefined) {
        stageSums[stage] += val;
        stageCounts[stage] += 1;
      }

      if (stage === 'won') {
        wonTotal += val;
        wonCount += 1;
      } else if (stage === 'lost') {
        lostCount += 1;
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
      stageCounts
    };
  }
}

export const crmStore = new CRMStore();
