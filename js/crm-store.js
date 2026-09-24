/**
 * Nexus CRM - Central State Store & Metrics Calculator
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
