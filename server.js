const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const WEBHOOK_FILE = path.join(DATA_DIR, 'webhook_leads.json');

// Ensure data folder and webhook storage file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(WEBHOOK_FILE)) {
  fs.writeFileSync(WEBHOOK_FILE, JSON.stringify([]), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readWebhookLeads() {
  try {
    const raw = fs.readFileSync(WEBHOOK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveWebhookLeads(leads) {
  try {
    fs.writeFileSync(WEBHOOK_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Webhook] Error saving leads:', err);
  }
}

const server = http.createServer((req, res) => {
  // CORS Headers for API & Webhooks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = req.url.split('?')[0];

  // =========================================================================
  // API: Webhook Ingestion Endpoint (POST /api/webhook/leads)
  // =========================================================================
  if (parsedUrl === '/api/webhook/leads' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const newLead = {
          id: 'lead-wh-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: data.name || data.nome || data.full_name || 'Novo Lead (Tráfego)',
          email: data.email || '',
          phone: data.phone || data.whatsapp || data.telefone || data.celular || '',
          company: data.company || data.empresa || 'Empresa Direta',
          value: Number(data.value || data.valor || 0),
          stage: data.stage || 'novo',
          priority: data.priority || 'alta',
          source: data.source || data.origem || 'Webhook (Meta/Kiwify)',
          notes: data.notes || data.mensagem || data.message || 'Lead capturado automaticamente via Webhook API.',
          createdAt: new Date().toISOString(),
          status: 'unread'
        };

        const leads = readWebhookLeads();
        leads.unshift(newLead);
        if (leads.length > 500) leads.length = 500;
        saveWebhookLeads(leads);

        console.log(`[Webhook] 📥 Novo lead recebido: ${newLead.name} (${newLead.phone || newLead.email})`);

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
    return;
  }

  // =========================================================================
  // API: Get Webhook Leads for CRM Ingestion (GET /api/webhook/leads)
  // =========================================================================
  if (parsedUrl === '/api/webhook/leads' && req.method === 'GET') {
    const leads = readWebhookLeads();
    res.writeHead(200, { 
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({ success: true, count: leads.length, leads }));
    return;
  }

  // =========================================================================
  // API: Acknowledge/Mark Leads as Read (POST /api/webhook/leads/ack)
  // =========================================================================
  if (parsedUrl === '/api/webhook/leads/ack' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { leadIds } = body ? JSON.parse(body) : { leadIds: [] };
        let leads = readWebhookLeads();
        if (Array.isArray(leadIds) && leadIds.length > 0) {
          leads = leads.map(l => leadIds.includes(l.id) ? { ...l, status: 'processed' } : l);
        } else {
          leads = leads.map(l => ({ ...l, status: 'processed' }));
        }
        saveWebhookLeads(leads);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Leads marcados como processados' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Erro ao processar ACK' }));
      }
    });
    return;
  }

  // =========================================================================
  // Static Files Serving
  // =========================================================================
  let relativePath = parsedUrl;
  if (relativePath === '/') relativePath = '/index.html';
  
  const filePath = path.join(__dirname, relativePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Arquivo não encontrado no Nexus CRM');
          } else {
            res.writeHead(200, { 
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(fallback);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 - Erro no servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Nexus CRM Enterprise & Webhooks ativos!`);
  console.log(`📡 URL Local: http://localhost:${PORT}`);
  console.log(`⚡ Endpoint Webhook: http://localhost:${PORT}/api/webhook/leads`);
  console.log(`🛡️ Segurança: Tríade CID & RBAC habilitados`);
  console.log(`======================================================\n`);
});
