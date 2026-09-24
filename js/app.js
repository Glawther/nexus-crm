/**
 * Nexus CRM - Application Orchestrator
 * Enterprise Grade CRM with AI, Cloud Firestore, WhatsApp Templates, Tasks & Timeline
 */

import { storage } from './storage-manager.js';
import { crmStore, STAGES, PRIORITIES, LOSS_REASONS, SALES_TEAM } from './crm-store.js';
import { 
  renderKPIs, 
  renderKanban, 
  renderTable, 
  renderTasksView,
  renderDetailedMetrics,
  renderLeadTimeline,
  renderConnectionStatus, 
  renderAuthBadge,
  renderSecurityView,
  showToast,
  WA_TEMPLATES,
  getWhatsAppLink,
  formatBRL,
  escapeHtml
} from './ui-renderer.js';
import { getSavedFirebaseConfig } from './config.js';
import { analyzeDealWithGemini, getSavedGeminiKey, saveGeminiKey } from './gemini-service.js';
import { 
  initAuth, 
  signInWithGoogle, 
  signOutUser, 
  onAuthChange,
  setUserRole,
  getCurrentRole,
  isAdmin,
  isEmployee,
  USER_ROLES,
  getCurrentUser,
  isSessionActive,
  setSessionActive,
  loginAsDemoRole,
  loginWithEmail,
  registerUser,
  logoutToPortal
} from './auth-service.js';
import { 
  exportCustomersToCSV, 
  exportAuditLogsToCSV, 
  exportBackupToJSON 
} from './export-service.js';

let draggedCustomerId = null;
let activeWhatsAppCustomerId = null;
let activeLeadDetailsCustomerId = null;
let activeProposalCustomerId = null;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupFilterEvents();
  setupDialogEvents();
  setupFirebaseConfigModal();
  setupGeminiModals();
  setupExportEvents();
  setupTasksEvents();
  setupWhatsAppModalEvents();
  setupLossReasonEvents();
  setupLeadDetailsEvents();
  setupBackupEvents();
  setupProposalModalEvents();
  setupImportModalEvents();
  setupAuthPortalEvents();
  setupCommandPalette();
  setupKeyboardShortcuts();
  setupPWA();

  // Setup Auth state
  onAuthChange((user) => {
    renderAuthBadge(user);
    if (crmStore) crmStore.emitChange();
  });
  initAuth();

  // Subscribe state store changes to DOM rendering
  crmStore.subscribe((state) => {
    renderKPIs(state.metrics, state.permissions);
    renderKanban(state.filteredCustomers, state.metrics, state.permissions);
    renderTable(state.filteredCustomers, state.permissions);
    renderTasksView(state.tasks, state.taskFilter, state.allCustomers);
    renderDetailedMetrics(state.metrics, state.allCustomers, state.permissions);
    renderSecurityView(state);
    renderConnectionStatus(state.storageMode);
    updateNavCounters(state);
    applyRoleUIRestrictions(state.permissions);

    // If lead details modal is currently open, refresh its timeline
    if (activeLeadDetailsCustomerId) {
      const currentCustomer = state.allCustomers.find(c => c.id === activeLeadDetailsCustomerId);
      if (currentCustomer) {
        renderLeadTimeline(currentCustomer);
      }
    }
  });

  // Subscribe storage engine changes to CRM store
  storage.subscribe((customers, mode) => {
    crmStore.setCustomers(customers, mode);
  });

  // Initialize storage (Firestore or Local)
  const initResult = await storage.init();
  if (initResult.mode === 'firestore') {
    showToast("Conectado em tempo real ao Google Cloud Firestore!", "success");
  } else {
    showToast("Nexus CRM iniciado em modo local de demonstração.", "info");
  }
});

function applyRoleUIRestrictions(permissions) {
  const geminiBtn = document.getElementById('sidebar-gemini-btn');
  const firebaseBtn = document.getElementById('sidebar-firebase-btn');
  const exportBtn = document.getElementById('btn-export-csv');

  if (permissions.canAccessCloudConfig) {
    if (geminiBtn) {
      geminiBtn.style.opacity = '1';
      geminiBtn.title = 'Configuração da Chave Gemini AI';
      geminiBtn.disabled = false;
    }
    if (firebaseBtn) {
      firebaseBtn.style.opacity = '1';
      firebaseBtn.title = 'Configuração do Google Cloud';
      firebaseBtn.disabled = false;
    }
  } else {
    // Restrito para Funcionários pela Confidencialidade (Tríade CID)
    if (geminiBtn) {
      geminiBtn.style.opacity = '0.4';
      geminiBtn.title = '🔒 Acesso restrito ao Administrador (Confidencialidade CID)';
    }
    if (firebaseBtn) {
      firebaseBtn.style.opacity = '0.4';
      firebaseBtn.title = '🔒 Acesso restrito ao Administrador (Confidencialidade CID)';
    }
  }

  if (exportBtn) {
    if (permissions.canExportAll) {
      exportBtn.title = 'Exportar base completa para CSV';
    } else {
      exportBtn.title = 'Exportar meus leads atribuídos para CSV (Confidencialidade)';
    }
  }
}

// ==========================================================================
// Navigation & Views
// ==========================================================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  const viewSections = document.querySelectorAll('.view-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.dataset.view;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      viewSections.forEach(section => {
        section.classList.toggle('active', section.id === `view-${targetView}`);
      });

      // Update header title
      const pageTitle = document.getElementById('current-page-title');
      if (pageTitle) {
        pageTitle.textContent = item.dataset.title || 'Pipeline de Vendas';
      }

      crmStore.setActiveView(targetView);
    });
  });
}

function updateNavCounters(state) {
  const pipelineCount = document.getElementById('nav-count-pipeline');
  const customersCount = document.getElementById('nav-count-customers');
  const tasksCount = document.getElementById('nav-count-tasks');

  if (pipelineCount) pipelineCount.textContent = state.allCustomers.length;
  if (customersCount) customersCount.textContent = state.allCustomers.length;
  if (tasksCount) {
    const pendingCount = (state.tasks || []).filter(t => !t.completed).length;
    tasksCount.textContent = pendingCount;
  }
}

// ==========================================================================
// Filters & Search
// ==========================================================================
function setupFilterEvents() {
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      crmStore.setSearchQuery(e.target.value);
    });
  }

  const filterPills = document.querySelectorAll('.filter-pill[data-priority]');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      crmStore.setPriorityFilter(pill.dataset.priority);
    });
  });
}

// ==========================================================================
// Drag & Drop Kanban Handlers
// ==========================================================================
window.handleDragStartCard = function(event, customerId) {
  draggedCustomerId = customerId;
  event.dataTransfer.setData('text/plain', customerId);
  event.currentTarget.classList.add('dragging');
};

window.handleDropCard = async function(event, targetStage) {
  event.preventDefault();
  const customerId = draggedCustomerId || event.dataTransfer.getData('text/plain');
  if (!customerId) return;

  const cards = document.querySelectorAll('.lead-card');
  cards.forEach(c => c.classList.remove('dragging'));

  if (targetStage === 'lost') {
    window.handleTriggerLossReason(customerId);
    draggedCustomerId = null;
    return;
  }

  try {
    await storage.updateStage(customerId, targetStage);
    const stageObj = STAGES.find(s => s.id === targetStage);
    showToast(`Oportunidade movida para "${stageObj ? stageObj.name : targetStage}".`, "success");
  } catch (err) {
    showToast("Erro ao mover estágio: " + err.message, "error");
  } finally {
    draggedCustomerId = null;
  }
};

window.handleMoveStage = async function(customerId, newStage) {
  if (newStage === 'lost') {
    window.handleTriggerLossReason(customerId);
    return;
  }

  try {
    await storage.updateStage(customerId, newStage);
    const stageObj = STAGES.find(s => s.id === newStage);
    showToast(`Oportunidade movida para "${stageObj ? stageObj.name : newStage}".`, "success");
  } catch (err) {
    showToast("Erro ao mover oportunidade: " + err.message, "error");
  }
};

// ==========================================================================
// Loss Reason Modal (Motivo de Perda)
// ==========================================================================
function setupLossReasonEvents() {
  const dialog = document.getElementById('loss-reason-dialog');
  const form = document.getElementById('loss-reason-form');
  const btnClose = document.getElementById('btn-close-loss-dialog');
  const btnCancel = document.getElementById('btn-cancel-loss-dialog');

  const closeDialog = () => dialog && dialog.close();
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCancel) btnCancel.addEventListener('click', closeDialog);

  window.handleTriggerLossReason = function(customerId) {
    document.getElementById('loss-customer-id').value = customerId;
    document.getElementById('select-loss-reason').value = 'price';
    document.getElementById('input-loss-details').value = '';
    dialog.showModal();
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const customerId = document.getElementById('loss-customer-id').value;
      const reasonVal = document.getElementById('select-loss-reason').value;
      const details = document.getElementById('input-loss-details').value.trim();

      const reasonObj = LOSS_REASONS.find(r => r.id === reasonVal);
      const reasonLabel = reasonObj ? reasonObj.label : reasonVal;

      try {
        await storage.setLossReason(customerId, reasonLabel, details);
        dialog.close();
        showToast("Oportunidade arquivada como perdida.", "info");
      } catch (err) {
        showToast("Erro ao registrar perda: " + err.message, "error");
      }
    });
  }
}

// ==========================================================================
// WhatsApp Templates Selector Modal
// ==========================================================================
function setupWhatsAppModalEvents() {
  const dialog = document.getElementById('whatsapp-dialog');
  const btnClose = document.getElementById('btn-close-wa-dialog');
  const btnCancel = document.getElementById('btn-cancel-wa-dialog');
  const btnSendConfirm = document.getElementById('btn-send-wa-confirm');
  const templatesContainer = document.getElementById('wa-templates-container');
  const messageTextarea = document.getElementById('wa-custom-message');

  const closeDialog = () => dialog && dialog.close();
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCancel) btnCancel.addEventListener('click', closeDialog);

  window.handleOpenWhatsAppModal = function(customerId) {
    const customer = storage.getCustomer(customerId);
    if (!customer || !customer.phone) {
      showToast("Esta oportunidade não possui telefone cadastrado.", "error");
      return;
    }

    activeWhatsAppCustomerId = customerId;
    document.getElementById('wa-dialog-title').textContent = `WhatsApp para ${customer.name}`;
    document.getElementById('wa-dialog-subtitle').textContent = `${customer.company || 'Sem empresa'} • ${customer.phone}`;

    // Render templates
    if (templatesContainer) {
      templatesContainer.innerHTML = WA_TEMPLATES.map((tmpl, idx) => {
        const text = tmpl.getText(customer);
        return `
          <div class="wa-template-card ${idx === 0 ? 'selected' : ''}" data-template-id="${tmpl.id}">
            <div class="wa-template-title">${tmpl.title}</div>
            <div class="wa-template-preview">${escapeHtml(text)}</div>
          </div>
        `;
      }).join('');

      // Set initial message
      messageTextarea.value = WA_TEMPLATES[0].getText(customer);

      // Bind click on template cards
      const cards = templatesContainer.querySelectorAll('.wa-template-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          cards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          const tmplId = card.dataset.templateId;
          const selectedTmpl = WA_TEMPLATES.find(t => t.id === tmplId);
          if (selectedTmpl) {
            messageTextarea.value = selectedTmpl.getText(customer);
          }
        });
      });
    }

    dialog.showModal();
  };

  if (btnSendConfirm) {
    btnSendConfirm.addEventListener('click', async () => {
      const customer = storage.getCustomer(activeWhatsAppCustomerId);
      if (!customer) return;

      const message = messageTextarea.value.trim();
      const link = getWhatsAppLink(customer.phone, message);
      if (!link) {
        showToast("Número de telefone inválido.", "error");
        return;
      }

      // Automatically log interaction in customer timeline
      await storage.addActivity(customer.id, {
        type: 'whatsapp',
        title: 'Mensagem de WhatsApp Enviada',
        text: message
      });

      // Open WhatsApp Web
      window.open(link, '_blank');
      dialog.close();
      showToast("Mensagem lançada e registrada no histórico!", "success");
    });
  }
}

// ==========================================================================
// Lead Details & Activity Timeline Modal
// ==========================================================================
function setupLeadDetailsEvents() {
  const dialog = document.getElementById('lead-details-dialog');
  const btnClose = document.getElementById('btn-close-lead-details');
  const btnCloseFooter = document.getElementById('btn-close-lead-details-footer');

  const closeDialog = () => {
    activeLeadDetailsCustomerId = null;
    dialog && dialog.close();
  };
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeDialog);

  window.handleOpenLeadDetails = function(customerId) {
    const customer = storage.getCustomer(customerId);
    if (!customer) return;

    activeLeadDetailsCustomerId = customerId;
    renderLeadTimeline(customer);
    dialog.showModal();
  };

  // Quick activity logging buttons
  const quickFormContainer = document.getElementById('quick-activity-form-container');
  const quickTitle = document.getElementById('quick-activity-title');
  const quickType = document.getElementById('quick-activity-type');
  const quickText = document.getElementById('quick-activity-text');
  const btnSaveQuick = document.getElementById('btn-save-quick-activity');
  const btnCancelQuick = document.getElementById('btn-cancel-quick-activity');

  const openQuickForm = (type, title) => {
    quickType.value = type;
    quickTitle.textContent = title;
    quickText.value = '';
    quickFormContainer.style.display = 'block';
    quickText.focus();
  };

  const btnLogCall = document.getElementById('btn-quick-log-call');
  const btnLogMeeting = document.getElementById('btn-quick-log-meeting');
  const btnLogNote = document.getElementById('btn-quick-log-note');

  if (btnLogCall) btnLogCall.addEventListener('click', () => openQuickForm('call', '📞 Registrar Ligação Telefônica'));
  if (btnLogMeeting) btnLogMeeting.addEventListener('click', () => openQuickForm('meeting', '📅 Registrar Reunião Comercial'));
  if (btnLogNote) btnLogNote.addEventListener('click', () => openQuickForm('note', '📝 Adicionar Nota Interna'));

  if (btnCancelQuick) {
    btnCancelQuick.addEventListener('click', () => {
      quickFormContainer.style.display = 'none';
    });
  }

  if (btnSaveQuick) {
    btnSaveQuick.addEventListener('click', async () => {
      if (!activeLeadDetailsCustomerId) return;
      const text = quickText.value.trim();
      if (!text) {
        showToast("Digite o conteúdo da interação.", "error");
        return;
      }

      const type = quickType.value;
      const titleMap = {
        call: 'Ligação Telefônica Realizada',
        meeting: 'Reunião Comercial Realizada',
        note: 'Nota Interna Adicionada'
      };

      await storage.addActivity(activeLeadDetailsCustomerId, {
        type,
        title: titleMap[type] || 'Interação',
        text
      });

      quickFormContainer.style.display = 'none';
      const updatedCustomer = storage.getCustomer(activeLeadDetailsCustomerId);
      if (updatedCustomer) renderLeadTimeline(updatedCustomer);
      showToast("Interação registrada com sucesso!", "success");
    });
  }
}

// ==========================================================================
// Tasks Management (Activity-Based Selling)
// ==========================================================================
function setupTasksEvents() {
  const taskForm = document.getElementById('new-task-form');
  const filterPills = document.querySelectorAll('#task-filter-pills .filter-pill');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      crmStore.setTaskFilter(pill.dataset.taskFilter);
    });
  });

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('task-input-title').value.trim();
      const type = document.getElementById('task-input-type').value;
      const customerId = document.getElementById('task-input-customer').value;
      const dueDate = document.getElementById('task-input-date').value;

      if (!customerId) {
        showToast("Selecione um cliente para vincular a tarefa.", "error");
        return;
      }

      try {
        await storage.addTask(customerId, { title, type, dueDate });
        taskForm.reset();
        document.getElementById('task-input-date').value = new Date().toISOString().split('T')[0];
        showToast("Tarefa comercial agendada com sucesso!", "success");
      } catch (err) {
        showToast("Erro ao agendar tarefa: " + err.message, "error");
      }
    });

    // Default task date to today
    const dateInput = document.getElementById('task-input-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  }

  window.handleToggleTask = async function(customerId, taskId) {
    try {
      await storage.toggleTask(customerId, taskId);
      showToast("Status da tarefa atualizado.", "success");
    } catch (err) {
      showToast("Erro ao atualizar tarefa: " + err.message, "error");
    }
  };
}

// ==========================================================================
// Security & Input Sanitization Engine (Tríade CID: Integridade)
// ==========================================================================
function sanitizeInput(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[<>]/g, '') // Strip angle brackets to eliminate stored HTML/XSS injection at ingress
    .trim();
}

function parseSafeDealValue(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? 0 : Math.min(num, 1000000000);
}

// ==========================================================================
// Customer Dialog (Add / Edit)
// ==========================================================================
function setupDialogEvents() {
  const customerDialog = document.getElementById('customer-dialog');
  const customerForm = document.getElementById('customer-form');
  const btnNewLead = document.getElementById('btn-new-lead');
  const btnCloseDialog = document.getElementById('btn-close-customer-dialog');
  const btnCancelDialog = document.getElementById('btn-cancel-customer-dialog');

  if (btnNewLead && customerDialog) {
    btnNewLead.addEventListener('click', () => {
      document.getElementById('dialog-customer-id').value = '';
      document.getElementById('customer-dialog-title').textContent = 'Nova Oportunidade / Lead';
      customerForm.reset();
      document.getElementById('input-deal-stage').value = 'lead';
      document.getElementById('input-deal-priority').value = 'medium';
      document.getElementById('input-deal-forecast').value = '';
      const assignedSelect = document.getElementById('input-customer-assigned');
      if (assignedSelect) {
        const currentUser = getCurrentUser();
        assignedSelect.value = currentUser?.email || 'lucas.vendas@nexuscrm.com';
      }
      customerDialog.showModal();
    });
  }

  const closeDialog = () => customerDialog && customerDialog.close();
  if (btnCloseDialog) btnCloseDialog.addEventListener('click', closeDialog);
  if (btnCancelDialog) btnCancelDialog.addEventListener('click', closeDialog);

  if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('dialog-customer-id').value;
      const name = sanitizeInput(document.getElementById('input-customer-name').value);
      const company = sanitizeInput(document.getElementById('input-customer-company').value);
      const role = sanitizeInput(document.getElementById('input-customer-role').value);
      const email = sanitizeInput(document.getElementById('input-customer-email').value);
      const phone = sanitizeInput(document.getElementById('input-customer-phone').value);
      const dealValue = parseSafeDealValue(document.getElementById('input-deal-value').value);
      const stage = document.getElementById('input-deal-stage').value;
      const priority = document.getElementById('input-deal-priority').value;
      const expectedCloseDate = document.getElementById('input-deal-forecast').value;
      const rawTags = document.getElementById('input-customer-tags').value;
      const tags = rawTags.split(',').map(t => sanitizeInput(t)).filter(Boolean);
      const notes = sanitizeInput(document.getElementById('input-customer-notes').value);

      // Consultor atribuído (RBAC / CID)
      const assignedSelect = document.getElementById('input-customer-assigned');
      const assignedEmail = assignedSelect ? assignedSelect.value : 'lucas.vendas@nexuscrm.com';
      const assignedMember = SALES_TEAM.find(m => m.email === assignedEmail) || {
        id: 'employee-user-02',
        name: 'Lucas Mendes (Consultor)',
        email: assignedEmail
      };

      const customerPayload = {
        name,
        company,
        role,
        email,
        phone,
        dealValue,
        stage,
        priority,
        expectedCloseDate,
        tags,
        notes,
        assignedTo: {
          id: assignedMember.id,
          name: assignedMember.name,
          email: assignedMember.email
        }
      };

      if (id) {
        customerPayload.id = id;
      }

      try {
        await storage.saveCustomer(customerPayload);
        customerDialog.close();
        showToast(id ? "Oportunidade atualizada com sucesso!" : "Novo lead adicionado com sucesso!", "success");
      } catch (err) {
        showToast("Erro ao salvar: " + err.message, "error");
      }
    });
  }
}

window.handleOpenEditCustomer = function(customerId) {
  const customerDialog = document.getElementById('customer-dialog');
  const customer = storage.getCustomer(customerId);
  if (!customer || !customerDialog) return;

  document.getElementById('dialog-customer-id').value = customer.id;
  document.getElementById('customer-dialog-title').textContent = 'Editar Oportunidade';
  document.getElementById('input-customer-name').value = customer.name || '';
  document.getElementById('input-customer-company').value = customer.company || '';
  document.getElementById('input-customer-role').value = customer.role || '';
  document.getElementById('input-customer-email').value = customer.email || '';
  document.getElementById('input-customer-phone').value = customer.phone || '';
  document.getElementById('input-deal-value').value = customer.dealValue || 0;
  document.getElementById('input-deal-stage').value = customer.stage || 'lead';
  document.getElementById('input-deal-priority').value = customer.priority || 'medium';
  document.getElementById('input-deal-forecast').value = customer.expectedCloseDate ? customer.expectedCloseDate.split('T')[0] : '';
  document.getElementById('input-customer-tags').value = (customer.tags || []).join(', ');
  document.getElementById('input-customer-notes').value = customer.notes || '';

  const assignedSelect = document.getElementById('input-customer-assigned');
  if (assignedSelect) {
    assignedSelect.value = customer.assignedTo?.email || 'lucas.vendas@nexuscrm.com';
  }

  customerDialog.showModal();
};

window.handleDeleteCustomer = async function(customerId) {
  if (!isAdmin()) {
    showToast("🔒 Ação bloqueada pela Tríade CID: Apenas Administradores têm permissão para excluir oportunidades definitivamente.", "error");
    return;
  }

  if (!confirm("Deseja realmente excluir esta oportunidade? Esta ação será registrada na trilha de auditoria (Integridade).")) return;
  try {
    await storage.deleteCustomer(customerId);
    showToast("Oportunidade removida definitivamente do sistema.", "info");
  } catch (err) {
    showToast("Erro ao excluir: " + err.message, "error");
  }
};

// ==========================================================================
// Firebase Configuration Dialog
// ==========================================================================
function setupFirebaseConfigModal() {
  const firebaseDialog = document.getElementById('firebase-dialog');
  const pillBtn = document.getElementById('connection-status-pill');
  const btnClose = document.getElementById('btn-close-firebase-dialog');
  const btnCancel = document.getElementById('btn-cancel-firebase-dialog');
  const form = document.getElementById('firebase-config-form');
  const btnDisconnect = document.getElementById('btn-disconnect-firebase');

  const openModal = () => {
    const existing = getSavedFirebaseConfig();
    if (existing) {
      document.getElementById('fb-input-apikey').value = existing.apiKey || '';
      document.getElementById('fb-input-projectid').value = existing.projectId || '';
      document.getElementById('fb-input-authdomain').value = existing.authDomain || '';
      document.getElementById('fb-input-storagebucket').value = existing.storageBucket || '';
      document.getElementById('fb-input-appid').value = existing.appId || '';
      if (btnDisconnect) btnDisconnect.style.display = 'inline-flex';
    } else {
      if (btnDisconnect) btnDisconnect.style.display = 'none';
    }
    firebaseDialog.showModal();
  };

  if (pillBtn) pillBtn.addEventListener('click', openModal);

  const sidebarFirebaseBtn = document.getElementById('sidebar-firebase-btn');
  if (sidebarFirebaseBtn) sidebarFirebaseBtn.addEventListener('click', openModal);

  const closeModal = () => firebaseDialog && firebaseDialog.close();
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apiKey = document.getElementById('fb-input-apikey').value.trim();
      const projectId = document.getElementById('fb-input-projectid').value.trim();
      const authDomain = document.getElementById('fb-input-authdomain').value.trim() || `${projectId}.firebaseapp.com`;
      const storageBucket = document.getElementById('fb-input-storagebucket').value.trim() || `${projectId}.appspot.com`;
      const appId = document.getElementById('fb-input-appid').value.trim() || `1:1234567890:web:abcdef`;

      const submitBtn = document.getElementById('btn-save-firebase');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Testando conexão...';
      submitBtn.disabled = true;

      try {
        const config = { apiKey, projectId, authDomain, storageBucket, appId };
        await storage.connectToFirebase(config);
        firebaseDialog.close();
        showToast("Sucesso! Conectado ao Google Cloud Firestore.", "success");
      } catch (err) {
        alert("Erro na conexão com o Firebase: " + err.message + "\n\nVerifique se o Firestore Database está ativo no seu console e se as regras de segurança permitem leitura/escrita.");
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      if (confirm("Deseja desconectar do Firebase e retornar ao modo local?")) {
        storage.disconnectFirebase();
        firebaseDialog.close();
        showToast("Desconectado do Firebase. Operando em modo local.", "info");
      }
    });
  }
}

// ==========================================================================
// Google Authentication Handlers
// ==========================================================================
window.handleSignInWithGoogle = async function() {
  try {
    const user = await signInWithGoogle();
    showToast(`Bem-vindo(a), ${user.displayName || 'Vendedor'}!`, "success");
  } catch (err) {
    showToast("Erro no login com Google: " + err.message, "error");
  }
};

window.handleSignOut = async function() {
  try {
    await signOutUser();
    showToast("Você saiu da sua conta Google.", "info");
  } catch (err) {
    showToast("Erro ao sair: " + err.message, "error");
  }
};

// ==========================================================================
// Gemini AI Modals & Handlers
// ==========================================================================
function setupGeminiModals() {
  const geminiDialog = document.getElementById('gemini-dialog');
  const btnClose = document.getElementById('btn-close-gemini-dialog');
  const btnCloseFooter = document.getElementById('btn-close-gemini-modal-footer');
  const btnCopyEmail = document.getElementById('btn-copy-proposal-email');

  const closeDialog = () => geminiDialog && geminiDialog.close();
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeDialog);

  if (btnCopyEmail) {
    btnCopyEmail.addEventListener('click', () => {
      const emailContent = document.getElementById('gemini-email-draft').textContent;
      navigator.clipboard.writeText(emailContent).then(() => {
        showToast("Rascunho de e-mail copiado para a área de transferência!", "success");
      }).catch(() => {
        showToast("Não foi possível copiar automaticamente.", "error");
      });
    });
  }

  // Gemini API Key Config Dialog
  const keyDialog = document.getElementById('gemini-key-dialog');
  const btnOpenKey = document.getElementById('sidebar-gemini-btn');
  const btnCloseKey = document.getElementById('btn-close-gemini-key-dialog');
  const btnCancelKey = document.getElementById('btn-cancel-gemini-key');
  const keyForm = document.getElementById('gemini-key-form');
  const keyInput = document.getElementById('input-gemini-key');

  if (btnOpenKey && keyDialog) {
    btnOpenKey.addEventListener('click', () => {
      if (keyInput) keyInput.value = getSavedGeminiKey();
      keyDialog.showModal();
    });
  }

  const closeKeyDialog = () => keyDialog && keyDialog.close();
  if (btnCloseKey) btnCloseKey.addEventListener('click', closeKeyDialog);
  if (btnCancelKey) btnCancelKey.addEventListener('click', closeKeyDialog);

  if (keyForm) {
    keyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = keyInput ? keyInput.value : '';
      saveGeminiKey(key);
      keyDialog.close();
      showToast(key ? "Chave do Google Gemini salva com sucesso!" : "Chave do Gemini removida. Usando motor heurístico.", "success");
    });
  }
}

window.handleAnalyzeWithAI = async function(customerId) {
  const geminiDialog = document.getElementById('gemini-dialog');
  const customer = storage.getCustomer(customerId);
  if (!customer || !geminiDialog) return;

  // Header info
  document.getElementById('gemini-dialog-customer-name').textContent = customer.name;
  document.getElementById('gemini-dialog-customer-meta').textContent = `${customer.company || 'Empresa'} • R$ ${Number(customer.dealValue || 0).toLocaleString('pt-BR')}`;

  // Reset to loading state
  document.getElementById('gemini-loading').style.display = 'block';
  document.getElementById('gemini-results').style.display = 'none';
  geminiDialog.showModal();

  try {
    const analysis = await analyzeDealWithGemini(customer);

    // Probability
    const prob = Math.round(analysis.probability || 0);
    document.getElementById('gemini-probability-number').textContent = `${prob}%`;
    document.getElementById('gemini-probability-bar').style.width = `${prob}%`;
    document.getElementById('gemini-summary-text').textContent = analysis.summary || '';

    // Keypoints
    const keypointsList = document.getElementById('gemini-keypoints-list');
    keypointsList.innerHTML = (analysis.keyPoints || []).map(p => `<li>${p}</li>`).join('');

    // Objections
    const objectionsList = document.getElementById('gemini-objections-list');
    objectionsList.innerHTML = (analysis.objections || []).map(o => `<li>${o}</li>`).join('');

    // Recommended Action
    document.getElementById('gemini-recommended-action').textContent = analysis.recommendedAction || 'Dar continuidade ao contato comercial.';

    // Email Draft
    document.getElementById('gemini-email-draft').textContent = analysis.proposalEmail || '';

    // Show results
    document.getElementById('gemini-loading').style.display = 'none';
    document.getElementById('gemini-results').style.display = 'block';
  } catch (err) {
    showToast("Erro ao processar análise da IA: " + err.message, "error");
    geminiDialog.close();
  }
};

// ==========================================================================
// Export CSV Events
// ==========================================================================
function setupExportEvents() {
  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const customers = crmStore.getState().filteredCustomers;
      try {
        exportCustomersToCSV(customers);
        showToast("Planilha CSV exportada com sucesso!", "success");
      } catch (err) {
        showToast("Erro ao exportar: " + err.message, "error");
      }
    });
  }
}

// ==========================================================================
// Disaster Recovery & Backup Events (Tríade CID: Disponibilidade)
// ==========================================================================
function setupBackupEvents() {
  const backupFileInput = document.getElementById('backup-file-input');

  window.handleDownloadBackup = function() {
    try {
      const snapshot = storage.createBackupSnapshot();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
      const downloadAnchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexus_crm_backup_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Snapshot de contingência exportado com sucesso!", "success");
    } catch (err) {
      showToast("Erro ao exportar backup: " + err.message, "error");
    }
  };

  window.handleTriggerRestoreBackup = function() {
    if (!isAdmin()) {
      showToast("🔒 Acesso negado: Apenas Administradores podem restaurar snapshots de backup (Tríade CID: Disponibilidade).", "error");
      return;
    }
    if (backupFileInput) backupFileInput.click();
  };

  if (backupFileInput) {
    backupFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          await storage.restoreBackupSnapshot(data);
          showToast("Banco restaurado com sucesso a partir do snapshot!", "success");
        } catch (err) {
          showToast("Falha na restauração do backup: " + err.message, "error");
        } finally {
          backupFileInput.value = '';
        }
      };
      reader.onerror = () => {
        showToast("Erro ao ler o arquivo de backup.", "error");
        backupFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }
}

// ==========================================================================
// Role Switching Handler (Tríade CID / RBAC Simulation)
// ==========================================================================
window.handleToggleRole = function() {
  const current = getCurrentRole();
  const newRole = current === USER_ROLES.ADMIN ? USER_ROLES.EMPLOYEE : USER_ROLES.ADMIN;
  setUserRole(newRole);
  const roleLabel = newRole === USER_ROLES.ADMIN ? 'Administrador (Acesso Total 🛡️)' : 'Funcionário / Consultor (Acesso Restrito 💼)';
  showToast(`Perfil alternado para: ${roleLabel}`, "info");
};

// ==========================================================================
// Proposal Modal Events (One-Click Proposal & PDF Print)
// ==========================================================================
function setupProposalModalEvents() {
  const dialog = document.getElementById('proposal-dialog');
  const btnClose = document.getElementById('btn-close-proposal-dialog');
  const btnCloseFooter = document.getElementById('btn-close-proposal-footer');
  const btnPrint = document.getElementById('btn-print-proposal');
  const btnSendWA = document.getElementById('btn-send-proposal-wa');

  const closeDialog = () => {
    activeProposalCustomerId = null;
    if (dialog) dialog.close();
  };
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeDialog);

  window.handleOpenProposalModal = function(customerId) {
    const customer = storage.getCustomer(customerId);
    if (!customer) return;

    activeProposalCustomerId = customerId;

    const propNum = `PROP-${new Date().getFullYear()}-${customer.id.replace(/\D/g, '').slice(-4) || '1042'}`;
    const today = new Date().toLocaleDateString('pt-BR');

    document.getElementById('prop-number').textContent = propNum;
    document.getElementById('prop-date').textContent = today;
    document.getElementById('prop-client-name').textContent = customer.name || '-';
    document.getElementById('prop-client-company').textContent = customer.company || 'Não informado';
    document.getElementById('prop-client-role').textContent = customer.role || 'Responsável Comercial';
    document.getElementById('prop-client-email').textContent = customer.email || 'Não informado';
    document.getElementById('prop-client-phone').textContent = customer.phone || 'Não informado';
    document.getElementById('prop-assigned-name').textContent = customer.assignedTo?.name || 'Lucas Mendes (Consultor)';
    document.getElementById('prop-assigned-email').textContent = customer.assignedTo?.email || 'lucas.vendas@nexuscrm.com';
    document.getElementById('prop-price-display').textContent = formatBRL(customer.dealValue);
    document.getElementById('prop-sign-client').textContent = customer.company || customer.name || 'Cliente Contratante';

    if (dialog) dialog.showModal();
  };

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnSendWA) {
    btnSendWA.addEventListener('click', async () => {
      if (!activeProposalCustomerId) return;
      const customer = storage.getCustomer(activeProposalCustomerId);
      if (!customer || !customer.phone) {
        showToast("Este cliente não possui telefone para envio via WhatsApp.", "error");
        return;
      }

      const msg = `Olá *${customer.name}*! Segue a Proposta Comercial formal da *Nexus CRM* para a *${customer.company || 'sua empresa'}* no valor de *${formatBRL(customer.dealValue)}*.\n\nPara validar o aceite e dar início à implantação, basta responder com seu 'De Acordo'. Estamos à sua disposição!`;
      const link = getWhatsAppLink(customer.phone, msg);
      if (link) {
        await storage.addActivity(customer.id, {
          type: 'whatsapp',
          title: 'Proposta Comercial Enviada via WhatsApp',
          text: `Proposta formal de ${formatBRL(customer.dealValue)} enviada para ${customer.phone}.`
        });
        window.open(link, '_blank');
        showToast("Proposta enviada para o WhatsApp!", "success");
      }
    });
  }
}

// ==========================================================================
// Lead Import Modal Events (Excel / CSV / Paste)
// ==========================================================================
function setupImportModalEvents() {
  const dialog = document.getElementById('import-dialog');
  const btnOpen = document.getElementById('btn-open-import-modal');
  const btnClose = document.getElementById('btn-close-import-dialog');
  const btnCancel = document.getElementById('btn-cancel-import');
  const btnConfirm = document.getElementById('btn-confirm-import');
  const dropzone = document.getElementById('import-dropzone-area');
  const fileInput = document.getElementById('input-csv-file');
  const textarea = document.getElementById('textarea-import-raw');
  const previewContainer = document.getElementById('import-preview-container');
  const previewTbody = document.getElementById('import-preview-tbody');
  const countLabel = document.getElementById('import-count-label');

  let parsedLeads = [];

  const closeDialog = () => {
    if (dialog) dialog.close();
    parsedLeads = [];
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      if (textarea) textarea.value = '';
      if (previewContainer) previewContainer.style.display = 'none';
      if (btnConfirm) btnConfirm.disabled = true;
      if (dialog) dialog.showModal();
    });
  }

  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCancel) btnCancel.addEventListener('click', closeDialog);

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (textarea) {
          textarea.value = event.target.result;
          parseAndRenderPreview(textarea.value);
        }
      };
      reader.readAsText(file);
    });
  }

  if (textarea) {
    textarea.addEventListener('input', () => {
      parseAndRenderPreview(textarea.value);
    });
  }

  function parseAndRenderPreview(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    parsedLeads = [];

    lines.forEach(line => {
      if (line.toLowerCase().startsWith('nome')) return; // Header skip
      const parts = line.includes(';') ? line.split(';') : line.split(',');
      if (parts.length >= 2) {
        const name = parts[0]?.trim();
        const company = parts[1]?.trim() || '';
        const phone = parts[2]?.trim() || '';
        const dealVal = parseFloat(parts[3]?.replace(/[^\d.]/g, '')) || 25000;
        const email = parts[4]?.trim() || '';

        if (name) {
          parsedLeads.push({
            name,
            company,
            phone,
            dealValue: dealVal,
            email,
            stage: 'lead',
            priority: 'medium',
            tags: ['#Importado']
          });
        }
      }
    });

    if (parsedLeads.length > 0) {
      previewContainer.style.display = 'block';
      countLabel.textContent = `${parsedLeads.length} lead(s) identificado(s) prontos para inclusão`;
      previewTbody.innerHTML = parsedLeads.slice(0, 10).map(l => `
        <tr>
          <td><strong>${escapeHtml(l.name)}</strong></td>
          <td>${escapeHtml(l.company)}</td>
          <td>${escapeHtml(l.phone || '-')}</td>
          <td style="color:#16a34a; font-weight:600;">${formatBRL(l.dealValue)}</td>
        </tr>
      `).join('') + (parsedLeads.length > 10 ? `<tr><td colspan="4" style="text-align:center; color:#64748b;">+ ${parsedLeads.length - 10} outros contatos...</td></tr>` : '');
      btnConfirm.disabled = false;
    } else {
      previewContainer.style.display = 'none';
      btnConfirm.disabled = true;
    }
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      if (parsedLeads.length === 0) return;

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Importando leads...';

      try {
        for (const lead of parsedLeads) {
          await storage.saveCustomer(lead);
        }
        crmStore.addAuditLog('Importação em Lote de Leads', `${parsedLeads.length} novos leads importados via planilha/texto com sucesso.`);
        closeDialog();
        showToast(`${parsedLeads.length} oportunidades importadas com sucesso para o pipeline!`, "success");
      } catch (err) {
        showToast("Erro durante a importação: " + err.message, "error");
      } finally {
        btnConfirm.textContent = 'Confirmar e Inserir no Pipeline';
      }
    });
  }
}

// ==========================================================================
// Authentication & Registration Portal Events (Tríade CID & RBAC)
// ==========================================================================
function setupAuthPortalEvents() {
  const portalScreen = document.getElementById('auth-portal-screen');
  const appContainer = document.getElementById('app-container');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const panelLogin = document.getElementById('auth-panel-login');
  const panelRegister = document.getElementById('auth-panel-register');
  const btnQuickAdmin = document.getElementById('btn-quick-login-admin');
  const btnQuickEmployee = document.getElementById('btn-quick-login-employee');
  const formLogin = document.getElementById('form-auth-login');
  const formRegister = document.getElementById('form-auth-register');
  const btnGooglePortal = document.getElementById('btn-login-google-portal');

  window.showAuthPortal = function() {
    if (portalScreen) portalScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
  };

  window.hideAuthPortal = function() {
    if (portalScreen) portalScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  };

  window.handleLogoutToPortal = function() {
    logoutToPortal();
    window.showAuthPortal();
    showToast("Sessão finalizada com sucesso. Tela bloqueada.", "info");
  };

  // Check initial session state - default to authenticated demo if first visit, or active session
  if (!isSessionActive()) {
    // If not active, show the executive login portal
    window.showAuthPortal();
  } else {
    window.hideAuthPortal();
  }

  // Tab switching
  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      if (panelLogin) panelLogin.style.display = 'block';
      if (panelRegister) panelRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      if (panelLogin) panelLogin.style.display = 'none';
      if (panelRegister) panelRegister.style.display = 'block';
    });
  }

  // Quick 1-click role logins
  if (btnQuickAdmin) {
    btnQuickAdmin.addEventListener('click', () => {
      loginAsDemoRole(USER_ROLES.ADMIN);
      window.hideAuthPortal();
      showToast("Conectado como Administrador do Sistema 🛡️ (Acesso Total 360°)", "success");
    });
  }

  if (btnQuickEmployee) {
    btnQuickEmployee.addEventListener('click', () => {
      loginAsDemoRole(USER_ROLES.EMPLOYEE);
      window.hideAuthPortal();
      showToast("Conectado como Lucas Mendes 💼 (Consultor Comercial)", "success");
    });
  }

  // Form Login submit
  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-input-email').value.trim();
      const password = document.getElementById('login-input-password').value;
      const role = document.getElementById('login-select-role').value;

      if (!email || !password) {
        showToast("Preencha todos os campos para entrar.", "error");
        return;
      }

      loginWithEmail(email, password, role);
      window.hideAuthPortal();
      const roleLabel = role === 'admin' ? 'Administrador 🛡️' : 'Funcionário 💼';
      showToast(`Bem-vindo(a) ao Nexus CRM! Perfil ativo: ${roleLabel}`, "success");
    });
  }

  // Form Register submit
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-input-name').value.trim();
      const email = document.getElementById('reg-input-email').value.trim();
      const company = document.getElementById('reg-input-company').value.trim();
      const role = document.getElementById('reg-select-role').value;
      const password = document.getElementById('reg-input-password').value;

      if (!name || !email || !password) {
        showToast("Preencha os campos obrigatórios.", "error");
        return;
      }

      registerUser(name, email, password, role, company);
      crmStore.addAuditLog('Novo Usuário Cadastrado', `Usuário "${name}" (${email}) registrado como ${role === 'admin' ? 'Administrador' : 'Funcionário'}.`);
      window.hideAuthPortal();
      showToast(`Conta criada com sucesso! Bem-vindo(a), ${name}!`, "success");
    });
  }

  // Google sign in in portal
  if (btnGooglePortal) {
    btnGooglePortal.addEventListener('click', async () => {
      try {
        const user = await signInWithGoogle();
        setSessionActive(true);
        window.hideAuthPortal();
        showToast(`Bem-vindo(a), ${user.displayName || 'Usuário Google'}!`, "success");
      } catch (err) {
        showToast("Erro no login Google: " + err.message, "error");
      }
    });
  }
}

// ==========================================================================
// Command Palette Engine (Spotlight / Raycast-style Ctrl+K Launcher)
// ==========================================================================
function setupCommandPalette() {
  const dialog = document.getElementById('command-palette-dialog');
  const input = document.getElementById('command-palette-input');
  const body = document.getElementById('command-palette-body');
  const btnTrigger = document.getElementById('btn-open-command-palette');

  if (!dialog || !input || !body) return;

  window.openCommandPalette = function() {
    dialog.showModal();
    input.value = '';
    renderPaletteItems('');
    setTimeout(() => input.focus(), 50);
  };

  window.closeCommandPalette = function() {
    dialog.close();
  };

  if (btnTrigger) {
    btnTrigger.addEventListener('click', window.openCommandPalette);
  }

  // Click outside backdrop to close
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      window.closeCommandPalette();
    }
  });

  input.addEventListener('input', (e) => {
    renderPaletteItems(e.target.value);
  });

  // Keyboard navigation inside the palette (ArrowUp, ArrowDown, Enter)
  input.addEventListener('keydown', (e) => {
    const items = body.querySelectorAll('.command-item');
    if (items.length === 0) return;

    let activeIndex = Array.from(items).findIndex(el => el.classList.contains('active'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeIndex >= 0) items[activeIndex].classList.remove('active');
      activeIndex = (activeIndex + 1) % items.length;
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeIndex >= 0) items[activeIndex].classList.remove('active');
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetItem = activeIndex >= 0 ? items[activeIndex] : items[0];
      if (targetItem) targetItem.click();
    }
  });

  function renderPaletteItems(query) {
    const q = (query || '').toLowerCase().trim();
    const state = crmStore.getState();
    const customers = state.allCustomers || [];

    const defaultActions = [
      {
        id: 'action-new-lead',
        icon: '➕',
        title: 'Nova Oportunidade / Lead',
        hint: 'Atalho: N',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          document.getElementById('btn-new-lead')?.click();
        }
      },
      {
        id: 'action-import-csv',
        icon: '📥',
        title: 'Importar Leads (CSV / Excel)',
        hint: 'Atalho: I',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          document.getElementById('btn-open-import-modal')?.click();
        }
      },
      {
        id: 'action-export-csv',
        icon: '📊',
        title: 'Exportar Base de Clientes (Excel CSV)',
        hint: 'Download UTF-8',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          document.getElementById('btn-export-csv')?.click();
        }
      },
      {
        id: 'action-export-audit',
        icon: '🛡️',
        title: 'Exportar Relatório de Auditoria (Tríade CID)',
        hint: 'Logs imutáveis',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          try {
            exportAuditLogsToCSV(state.auditLogs);
            showToast("Relatório de auditoria exportado com sucesso!", "success");
          } catch (err) {
            showToast("Erro ao exportar logs: " + err.message, "error");
          }
        }
      },
      {
        id: 'action-toggle-role',
        icon: '🔄',
        title: 'Alternar Papel (Administrador / Funcionário)',
        hint: 'RBAC',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          window.handleToggleRole();
        }
      },
      {
        id: 'action-shortcuts',
        icon: '⌨️',
        title: 'Guia de Atalhos do Teclado',
        hint: 'Atalho: ?',
        category: 'Ações Rápidas',
        run: () => {
          window.closeCommandPalette();
          document.getElementById('shortcuts-dialog')?.showModal();
        }
      },
      {
        id: 'nav-pipeline',
        icon: '📌',
        title: 'Ir para Funil de Vendas (Kanban)',
        hint: 'Atalho: 1',
        category: 'Navegação',
        run: () => {
          window.closeCommandPalette();
          window.location.hash = 'pipeline';
        }
      },
      {
        id: 'nav-customers',
        icon: '👥',
        title: 'Ir para Clientes & Leads',
        hint: 'Atalho: 2',
        category: 'Navegação',
        run: () => {
          window.closeCommandPalette();
          window.location.hash = 'customers';
        }
      },
      {
        id: 'nav-tasks',
        icon: '📅',
        title: 'Ir para Tarefas & Follow-up',
        hint: 'Atalho: 3',
        category: 'Navegação',
        run: () => {
          window.closeCommandPalette();
          window.location.hash = 'tasks';
        }
      },
      {
        id: 'nav-metrics',
        icon: '📈',
        title: 'Ir para Métricas, Metas Q4 e Comissões',
        hint: 'Atalho: 4',
        category: 'Navegação',
        run: () => {
          window.closeCommandPalette();
          window.location.hash = 'metrics';
        }
      },
      {
        id: 'nav-security',
        icon: '🔒',
        title: 'Ir para Tríade CID & Governança',
        hint: 'Atalho: 5',
        category: 'Navegação',
        run: () => {
          window.closeCommandPalette();
          window.location.hash = 'security';
        }
      }
    ];

    let html = '';

    if (!q) {
      const categories = ['Ações Rápidas', 'Navegação'];
      categories.forEach(cat => {
        const items = defaultActions.filter(a => a.category === cat);
        html += `<div class="command-group-title">${cat}</div>`;
        items.forEach((item, idx) => {
          const isFirst = cat === 'Ações Rápidas' && idx === 0;
          html += `
            <div class="command-item ${isFirst ? 'active' : ''}" data-action-id="${item.id}">
              <div class="command-item-left">
                <span class="command-item-icon">${item.icon}</span>
                <span>${escapeHtml(item.title)}</span>
              </div>
              <span class="command-item-hint">${escapeHtml(item.hint)}</span>
            </div>
          `;
        });
      });
    } else {
      const matchedActions = defaultActions.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.hint.toLowerCase().includes(q)
      );

      const matchedCustomers = customers.filter(c => 
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      ).slice(0, 8);

      if (matchedActions.length > 0) {
        html += `<div class="command-group-title">Ações do Sistema</div>`;
        matchedActions.forEach((item, idx) => {
          html += `
            <div class="command-item ${idx === 0 ? 'active' : ''}" data-action-id="${item.id}">
              <div class="command-item-left">
                <span class="command-item-icon">${item.icon}</span>
                <span>${escapeHtml(item.title)}</span>
              </div>
              <span class="command-item-hint">${escapeHtml(item.hint)}</span>
            </div>
          `;
        });
      }

      if (matchedCustomers.length > 0) {
        html += `<div class="command-group-title">Oportunidades &amp; Clientes (${matchedCustomers.length})</div>`;
        matchedCustomers.forEach((c, idx) => {
          const isAct = matchedActions.length === 0 && idx === 0;
          html += `
            <div class="command-item ${isAct ? 'active' : ''}" data-customer-id="${c.id}">
              <div class="command-item-left">
                <span class="command-item-icon">🏢</span>
                <div>
                  <div style="font-weight: 600; font-size: 0.82rem;">${escapeHtml(c.name)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(c.company || 'Sem empresa')} • ${formatBRL(c.dealValue)}</div>
                </div>
              </div>
              <span class="command-item-hint">Ver Detalhes ↵</span>
            </div>
          `;
        });
      }

      if (matchedActions.length === 0 && matchedCustomers.length === 0) {
        html = `
          <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            Nenhum resultado encontrado para "<strong>${escapeHtml(q)}</strong>".
          </div>
        `;
      }
    }

    body.innerHTML = html;

    body.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('click', () => {
        const actionId = item.getAttribute('data-action-id');
        const customerId = item.getAttribute('data-customer-id');

        if (actionId) {
          const action = defaultActions.find(a => a.id === actionId);
          if (action) action.run();
        } else if (customerId) {
          window.closeCommandPalette();
          window.handleOpenLeadDetails(customerId);
        }
      });
    });
  }
}

// ==========================================================================
// Keyboard Shortcuts Engine (?)
// ==========================================================================
function setupKeyboardShortcuts() {
  const shortcutsDialog = document.getElementById('shortcuts-dialog');
  const btnOpenShortcuts = document.getElementById('btn-open-shortcuts');
  const btnCloseShortcuts = document.getElementById('btn-close-shortcuts-dialog');
  const btnCloseShortcutsFooter = document.getElementById('btn-close-shortcuts-footer');

  if (btnOpenShortcuts && shortcutsDialog) {
    btnOpenShortcuts.addEventListener('click', () => shortcutsDialog.showModal());
  }
  if (btnCloseShortcuts && shortcutsDialog) {
    btnCloseShortcuts.addEventListener('click', () => shortcutsDialog.close());
  }
  if (btnCloseShortcutsFooter && shortcutsDialog) {
    btnCloseShortcutsFooter.addEventListener('click', () => shortcutsDialog.close());
  }

  document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K: Open Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.openCommandPalette) window.openCommandPalette();
      return;
    }

    // Do not trigger single-key shortcuts while typing in inputs
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    );

    if (isTyping) {
      if (e.key === 'Escape') activeEl.blur();
      return;
    }

    // Global Single-Key Shortcuts
    if (e.key === '?') {
      e.preventDefault();
      if (shortcutsDialog) shortcutsDialog.showModal();
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      const customerDialog = document.getElementById('customer-dialog');
      if (customerDialog) {
        document.getElementById('customer-form')?.reset();
        document.getElementById('dialog-customer-id').value = '';
        document.getElementById('customer-dialog-title').textContent = 'Nova Oportunidade / Lead';
        customerDialog.showModal();
      }
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      const importDialog = document.getElementById('import-dialog');
      if (importDialog) importDialog.showModal();
    } else if (e.key === '1') {
      window.location.hash = 'pipeline';
    } else if (e.key === '2') {
      window.location.hash = 'customers';
    } else if (e.key === '3') {
      window.location.hash = 'tasks';
    } else if (e.key === '4') {
      window.location.hash = 'metrics';
    } else if (e.key === '5') {
      window.location.hash = 'security';
    }
  });
}

// ==========================================================================
// Progressive Web App (PWA) & Service Worker Registration
// ==========================================================================
function setupPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[Nexus PWA] Service Worker registrado com sucesso no escopo:', reg.scope);
      }).catch((err) => {
        console.warn('[Nexus PWA] Falha ao registrar Service Worker:', err);
      });
    });
  }

  let deferredPrompt = null;
  const btnInstall = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'inline-flex';
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast("Nexus CRM instalado com sucesso no seu sistema!", "success");
      }
      deferredPrompt = null;
      btnInstall.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none';
    showToast("Nexus CRM configurado como aplicativo nativo!", "success");
  });
}



