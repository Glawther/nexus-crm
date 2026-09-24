/**
 * Nexus CRM - UI Renderer & DOM Templates
 * Sober Executive White Theme with WhatsApp 1-Click Integration
 */

import { STAGES, PRIORITIES } from './crm-store.js';

export function formatBRL(amount) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds a direct 1-click WhatsApp web link
 */
export function getWhatsAppLink(phone, name) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 8) return null;
  // If no international code, assume Brazil (+55)
  const fullNumber = digits.length <= 11 ? `55${digits}` : digits;
  const greeting = encodeURIComponent(`Olá ${name || ''}, tudo bem? Sou da equipe comercial do Nexus CRM. Gostaria de falar sobre sua proposta.`);
  return `https://wa.me/${fullNumber}?text=${greeting}`;
}

/**
 * Updates KPI Summary Cards with Sober Corporate Styling
 */
export function renderKPIs(metrics) {
  const container = document.getElementById('kpi-container');
  if (!container) return;

  container.innerHTML = `
    <div class="kpi-card" style="--card-accent: #0f172a;">
      <div class="kpi-header">
        <span class="kpi-title">Pipeline em Aberto</span>
        <div class="kpi-icon-wrap" style="color: #0f172a;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      </div>
      <div class="kpi-value">${formatBRL(metrics.pipelineTotal)}</div>
      <div class="kpi-subtext">
        <span class="kpi-badge positive">${metrics.activeDealsCount} oportunidades</span> ativas no funil
      </div>
    </div>

    <div class="kpi-card" style="--card-accent: #16a34a;">
      <div class="kpi-header">
        <span class="kpi-title">Negócios Fechados</span>
        <div class="kpi-icon-wrap" style="color: #16a34a;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
      </div>
      <div class="kpi-value" style="color: #16a34a;">${formatBRL(metrics.wonTotal)}</div>
      <div class="kpi-subtext">
        <span class="kpi-badge positive">${metrics.wonCount} contratos</span> assinados com sucesso
      </div>
    </div>

    <div class="kpi-card" style="--card-accent: #2563eb;">
      <div class="kpi-header">
        <span class="kpi-title">Taxa de Conversão</span>
        <div class="kpi-icon-wrap" style="color: #2563eb;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
      </div>
      <div class="kpi-value">${metrics.conversionRate}%</div>
      <div class="kpi-subtext">
        De decisões tomadas (Ganhos vs Perdidos)
      </div>
    </div>

    <div class="kpi-card" style="--card-accent: #0284c7;">
      <div class="kpi-header">
        <span class="kpi-title">Ticket Médio</span>
        <div class="kpi-icon-wrap" style="color: #0284c7;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
        </div>
      </div>
      <div class="kpi-value">${formatBRL(metrics.avgTicket)}</div>
      <div class="kpi-subtext">
        Média de valor por oportunidade
      </div>
    </div>
  `;
}

/**
 * Renders the Kanban Board Columns and Cards
 */
export function renderKanban(customers, metrics) {
  const container = document.getElementById('pipeline-columns');
  if (!container) return;

  container.innerHTML = STAGES.map(stage => {
    const stageCustomers = customers.filter(c => (c.stage || 'lead') === stage.id);
    const stageSum = metrics.stageSums[stage.id] || 0;

    return `
      <div class="pipeline-column" data-stage="${stage.id}" ondragover="event.preventDefault()" ondrop="window.handleDropCard(event, '${stage.id}')">
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-indicator" style="background-color: ${stage.color};"></span>
            <h3 class="column-title">${stage.name}</h3>
            <span class="column-count">${stageCustomers.length}</span>
          </div>
          <span class="column-amount">${formatBRL(stageSum)}</span>
        </div>

        <div class="cards-container">
          ${stageCustomers.length === 0 ? `
            <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); background: #ffffff;">
              Nenhum lead nesta etapa
            </div>
          ` : stageCustomers.map(customer => renderLeadCard(customer)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderLeadCard(customer) {
  const priorityClass = customer.priority || 'medium';
  const priorityLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' }[priorityClass] || 'Média';
  const tagsHtml = (customer.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
  const waLink = getWhatsAppLink(customer.phone, customer.name);

  return `
    <div class="lead-card" 
         draggable="true" 
         ondragstart="window.handleDragStartCard(event, '${customer.id}')"
         data-id="${customer.id}">
      <div class="lead-card-header">
        <div class="lead-name">${escapeHtml(customer.name)}</div>
        <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
      </div>
      
      <div class="lead-company">
        ${customer.company ? `🏢 ${escapeHtml(customer.company)}` : ''}
        ${customer.role ? ` • ${escapeHtml(customer.role)}` : ''}
      </div>

      <div class="lead-value">${formatBRL(customer.dealValue)}</div>

      ${customer.tags && customer.tags.length > 0 ? `<div class="lead-tags">${tagsHtml}</div>` : ''}

      ${customer.notes ? `
        <div style="font-size: 0.72rem; color: var(--text-secondary); background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 4px 6px; margin-bottom: 0.5rem; max-height: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(customer.notes)}">
          💬 ${escapeHtml(customer.notes)}
        </div>
      ` : ''}

      <div class="card-footer">
        <select class="move-stage-select" onchange="window.handleMoveStage('${customer.id}', this.value)" title="Mover estágio">
          ${STAGES.map(s => `
            <option value="${s.id}" ${customer.stage === s.id ? 'selected' : ''}>
              ${s.name}
            </option>
          `).join('')}
        </select>

        <div class="card-actions">
          ${waLink ? `
            <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-wa" title="Chamar no WhatsApp">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              <span>Whats</span>
            </a>
          ` : ''}

          <button class="action-btn" onclick="window.handleAnalyzeWithAI('${customer.id}')" title="Analisar com Google Gemini AI" style="color: #2563eb;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </button>
          <button class="action-btn" onclick="window.handleOpenEditCustomer('${customer.id}')" title="Editar oportunidade">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="action-btn" onclick="window.handleDeleteCustomer('${customer.id}')" title="Excluir" style="color: var(--color-lost);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Customer Data Table View
 */
export function renderTable(customers) {
  const tbody = document.getElementById('customer-table-body');
  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted); background: #ffffff;">
          Nenhum cliente ou lead encontrado com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = customers.map(customer => {
    const initials = (customer.name || 'C')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const stageObj = STAGES.find(s => s.id === customer.stage) || STAGES[0];
    const priorityLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' }[customer.priority] || 'Média';
    const waLink = getWhatsAppLink(customer.phone, customer.name);

    return `
      <tr>
        <td>
          <div class="customer-cell">
            <div class="customer-avatar">${initials}</div>
            <div>
              <div class="customer-name">${escapeHtml(customer.name)}</div>
              <div class="customer-subtext">${escapeHtml(customer.company || 'Sem empresa')}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(customer.email || '-')}</div>
          <div class="customer-subtext" style="display: flex; align-items: center; gap: 0.4rem; margin-top: 2px;">
            <span>${escapeHtml(customer.phone || '-')}</span>
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-wa" title="Chamar no WhatsApp" style="padding: 1px 5px; font-size: 0.68rem;">
                Whats
              </a>
            ` : ''}
          </div>
        </td>
        <td>
          <span style="font-weight: 700; color: var(--color-won); font-family: var(--font-heading);">
            ${formatBRL(customer.dealValue)}
          </span>
        </td>
        <td>
          <span class="stage-badge" style="background: ${stageObj.bg}; color: ${stageObj.color}; border: 1px solid ${stageObj.color}30;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${stageObj.color}"></span>
            ${stageObj.name}
          </span>
        </td>
        <td>
          <span class="priority-badge ${customer.priority || 'medium'}">${priorityLabel}</span>
        </td>
        <td>
          ${(customer.tags || []).slice(0, 3).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join(' ')}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-outline btn-sm" onclick="window.handleAnalyzeWithAI('${customer.id}')" style="margin-right: 0.35rem; color: #2563eb; border-color: #cbd5e1;" title="Análise com Gemini AI">
            ✦ IA
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.handleOpenEditCustomer('${customer.id}')" style="margin-right: 0.35rem;">
            Editar
          </button>
          <button class="btn btn-danger-ghost btn-sm" onclick="window.handleDeleteCustomer('${customer.id}')">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Updates User Authentication Status Badge
 */
export function renderAuthBadge(user) {
  const container = document.getElementById('auth-status-container');
  if (!container) return;

  if (user) {
    container.innerHTML = `
      <div class="user-profile-badge">
        ${user.photoURL ? `<img src="${user.photoURL}" class="user-avatar-img" alt="${escapeHtml(user.name)}">` : `
          <div style="width: 22px; height: 22px; border-radius: 50%; background: #0f172a; display:flex; align-items:center; justify-content:center; font-size:10px; color:#fff; font-weight:700;">
            ${(user.name || 'U')[0].toUpperCase()}
          </div>
        `}
        <span style="font-weight: 600;">${escapeHtml(user.name.split(' ')[0])}</span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-auth-logout" style="padding: 2px 7px; font-size: 0.75rem;" title="Sair da conta">Sair</button>
      </div>
    `;
    const btnLogout = document.getElementById('btn-auth-logout');
    if (btnLogout) btnLogout.addEventListener('click', window.handleSignOut);
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-outline btn-sm" id="btn-auth-login" style="font-size: 0.8rem; gap: 0.4rem;">
        <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"/><path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/></svg>
        <span>Entrar com Google</span>
      </button>
    `;
    const btnLogin = document.getElementById('btn-auth-login');
    if (btnLogin) btnLogin.addEventListener('click', window.handleSignInWithGoogle);
  }
}

/**
 * Updates Connection Pill in Header & Sidebar
 */
export function renderConnectionStatus(mode) {
  const pill = document.getElementById('connection-status-pill');
  if (!pill) return;

  if (mode === 'firestore') {
    pill.className = 'connection-pill online';
    pill.innerHTML = `
      <span class="pulse-dot"></span>
      <span>Google Cloud Firestore</span>
    `;
    pill.title = 'Conectado em tempo real com o banco de dados do Google';
  } else {
    pill.className = 'connection-pill local';
    pill.innerHTML = `
      <span class="pulse-dot" style="background-color: #d97706; box-shadow: 0 0 6px #d97706;"></span>
      <span>Modo Local / Demo</span>
    `;
    pill.title = 'Clique para conectar suas credenciais do Firebase';
  }
}

/**
 * Global Toast Notifications
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success' 
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : type === 'error'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  toast.innerHTML = `
    ${iconSvg}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
