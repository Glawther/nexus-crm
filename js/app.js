import { storage } from './storage-manager.js';
import { crmStore, STAGES, PRIORITIES } from './crm-store.js';
import { 
  renderKPIs, 
  renderKanban, 
  renderTable, 
  renderConnectionStatus, 
  renderAuthBadge,
  showToast 
} from './ui-renderer.js';
import { getSavedFirebaseConfig } from './config.js';
import { analyzeDealWithGemini, getSavedGeminiKey, saveGeminiKey } from './gemini-service.js';
import { initAuth, signInWithGoogle, signOutUser, onAuthChange } from './auth-service.js';
import { exportCustomersToCSV } from './export-service.js';

let draggedCustomerId = null;

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
    renderConnectionStatus(state.storageMode);
    updateNavCounters(state);
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
  if (pipelineCount) pipelineCount.textContent = state.allCustomers.length;
  if (customersCount) customersCount.textContent = state.allCustomers.length;
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
  try {
    await storage.updateStage(customerId, newStage);
    const stageObj = STAGES.find(s => s.id === newStage);
    showToast(`Oportunidade movida para "${stageObj ? stageObj.name : newStage}".`, "success");
  } catch (err) {
    showToast("Erro ao mover oportunidade: " + err.message, "error");
  }
};

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
  const customers = storage.getCustomers();
  const customer = customers.find(c => c.id === customerId);
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
  const customer = storage.getCustomers().find(c => c.id === customerId);
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

