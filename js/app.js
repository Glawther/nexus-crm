/**
 * Nexus CRM - Application Orchestrator
 * Enterprise Grade CRM with AI, Cloud Firestore, WhatsApp Templates, Tasks & Timeline
 */

import { storage } from './storage-manager.js';
import { crmStore, STAGES, PRIORITIES, LOSS_REASONS } from './crm-store.js';
import { 
  renderKPIs, 
  renderKanban, 
  renderTable, 
  renderTasksView,
  renderDetailedMetrics,
  renderLeadTimeline,
  renderConnectionStatus, 
  renderAuthBadge,
  showToast,
  WA_TEMPLATES,
  getWhatsAppLink
} from './ui-renderer.js';
import { getSavedFirebaseConfig } from './config.js';
import { analyzeDealWithGemini, getSavedGeminiKey, saveGeminiKey } from './gemini-service.js';
import { initAuth, signInWithGoogle, signOutUser, onAuthChange } from './auth-service.js';
import { exportCustomersToCSV } from './export-service.js';

let draggedCustomerId = null;
let activeWhatsAppCustomerId = null;
let activeLeadDetailsCustomerId = null;

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

  // Setup Auth state
  onAuthChange((user) => {
    renderAuthBadge(user);
  });
  initAuth();

  // Subscribe state store changes to DOM rendering
  crmStore.subscribe((state) => {
    renderKPIs(state.metrics);
    renderKanban(state.filteredCustomers, state.metrics);
    renderTable(state.filteredCustomers);
    renderTasksView(state.tasks, state.taskFilter, state.allCustomers);
    renderDetailedMetrics(state.metrics);
    renderConnectionStatus(state.storageMode);
    updateNavCounters(state);

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
      const name = document.getElementById('input-customer-name').value.trim();
      const company = document.getElementById('input-customer-company').value.trim();
      const role = document.getElementById('input-customer-role').value.trim();
      const email = document.getElementById('input-customer-email').value.trim();
      const phone = document.getElementById('input-customer-phone').value.trim();
      const dealValue = parseFloat(document.getElementById('input-deal-value').value) || 0;
      const stage = document.getElementById('input-deal-stage').value;
      const priority = document.getElementById('input-deal-priority').value;
      const expectedCloseDate = document.getElementById('input-deal-forecast').value;
      const rawTags = document.getElementById('input-customer-tags').value;
      const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
      const notes = document.getElementById('input-customer-notes').value.trim();

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
        notes
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

  customerDialog.showModal();
};

window.handleDeleteCustomer = async function(customerId) {
  if (!confirm("Deseja realmente excluir esta oportunidade?")) return;
  try {
    await storage.deleteCustomer(customerId);
    showToast("Oportunidade removida.", "info");
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
