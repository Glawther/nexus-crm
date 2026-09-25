/**
 * Nexus CRM - Webhook Controller
 * Handles inbound lead ingestion, status acknowledgments and retrieval.
 */

const { getWebhookLeads, saveWebhookLeads, normalizeLeadPayload } = require('../services/lead-storage');

/**
 * Handles POST /api/webhook/leads
 */
async function handleIngestLead(req, res) {
  let body = '';
  req.on('data', chunk => { 
    body += chunk; 
    // Guard against oversized payload attacks (max 1MB)
    if (body.length > 1024 * 1024) {
      req.connection.destroy();
    }
  });

  req.on('end', async () => {
    try {
      const rawData = body ? JSON.parse(body) : {};
      const newLead = normalizeLeadPayload(rawData);

      const leads = await getWebhookLeads();
      leads.unshift(newLead);
      if (leads.length > 500) leads.length = 500;
      await saveWebhookLeads(leads);

      console.log(`[Webhook Controller] 📥 Lead recebido: ${newLead.name} (${newLead.phone || newLead.email})`);

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        message: 'Lead recebido com sucesso no Nexus CRM',
        lead: newLead
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'JSON inválido no corpo da requisição' }));
    }
  });
}

/**
 * Handles GET /api/webhook/leads
 */
async function handleGetLeads(req, res) {
  const leads = await getWebhookLeads();
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify({ success: true, count: leads.length, leads }));
}

/**
 * Handles POST /api/webhook/leads/ack
 */
async function handleAcknowledgeLeads(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { leadIds } = body ? JSON.parse(body) : { leadIds: [] };
      let leads = await getWebhookLeads();

      if (Array.isArray(leadIds) && leadIds.length > 0) {
        leads = leads.map(l => leadIds.includes(l.id) ? { ...l, status: 'processed' } : l);
      } else {
        leads = leads.map(l => ({ ...l, status: 'processed' }));
      }

      await saveWebhookLeads(leads);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Leads marcados como processados' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Erro ao processar ACK' }));
    }
  });
}

module.exports = {
  handleIngestLead,
  handleGetLeads,
  handleAcknowledgeLeads
};
