/**
 * Agent OS Database - SQLite local
 * Providers, models, agents, apps, conversations, messages
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DB_DIR, 'agent-os.db');

if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ SCHEMA ============

db.exec(`
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  auth_value TEXT,
  auth_status TEXT DEFAULT 'pending',
  base_url TEXT,
  cli_command TEXT,
  install_command TEXT,
  config TEXT DEFAULT '{}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  type TEXT DEFAULT 'cloud',
  endpoint TEXT,
  capabilities TEXT DEFAULT '[]',
  config TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  model_id TEXT REFERENCES models(id),
  agent_type TEXT DEFAULT 'smol',
  acpx_command TEXT,
  system_prompt TEXT,
  capabilities TEXT DEFAULT '[]',
  config TEXT DEFAULT '{}',
  icon TEXT DEFAULT 'bot',
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  agent_id TEXT REFERENCES agents(id),
  config TEXT DEFAULT '{}',
  dock_pinned INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  session_id TEXT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id TEXT,
  model_id TEXT,
  routing TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  message_id INTEGER REFERENCES messages(id),
  file_path TEXT NOT NULL,
  action TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ============ SEED DEFAULTS ============

const seedProviders = db.prepare(`INSERT OR IGNORE INTO providers (id, name, auth_type, cli_command, install_command) VALUES (?, ?, ?, ?, ?)`);
const seedModel = db.prepare(`INSERT OR IGNORE INTO models (id, provider_id, name, model_id, type, endpoint, capabilities) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const seedAgent = db.prepare(`INSERT OR IGNORE INTO agents (id, name, description, model_id, agent_type, acpx_command, system_prompt, capabilities, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

// Providers
seedProviders.run('anthropic', 'Anthropic (Claude)', 'cli_login', 'claude', 'npm install -g @anthropic-ai/claude-code');
seedProviders.run('google', 'Google (Gemini)', 'cli_login', 'gemini', 'npm install -g @google/gemini-cli');
seedProviders.run('huggingface', 'HuggingFace', 'api_key', null, null);
seedProviders.run('openai', 'OpenAI', 'api_key', null, null);
seedProviders.run('openrouter', 'OpenRouter', 'api_key', null, null);
seedProviders.run('local', 'Local (llama-server)', 'none', null, null);
seedProviders.run('cline', 'Cline', 'api_key', 'cline', 'npm install -g cline');

// Models
seedModel.run('claude-opus-4-6', 'anthropic', 'Claude Opus 4.6', 'claude-opus-4-6', 'cloud', null, '["code","analysis","planning","debugging"]');
seedModel.run('claude-sonnet-4-6', 'anthropic', 'Claude Sonnet 4.6', 'claude-sonnet-4-6', 'cloud', null, '["code","analysis","planning"]');
seedModel.run('llama-3.3-70b', 'huggingface', 'Llama 3.3 70B', 'llama-3.3-70b-versatile', 'cloud', 'https://router.huggingface.co/groq/openai/v1/chat/completions', '["chat","analysis","routing"]');
seedModel.run('llama-4-scout', 'huggingface', 'Llama 4 Scout 17B', 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 'cloud', null, '["chat","analysis"]');
seedModel.run('agent-os-1.5b', 'local', 'Agent OS 1.5B', 'agent-os-1b5-q8', 'local', 'http://localhost:8080', '["sql","database","supabase"]');
seedModel.run('gemini-pro', 'google', 'Gemini 2.5 Pro', 'gemini-2.5-pro', 'cloud', null, '["code","analysis","vision"]');

// Agents
seedAgent.run('gestor', 'Gestor', 'Orquestrador central - roteia tarefas e responde duvidas', 'llama-3.3-70b', 'smol', null, 'Voce e o gestor do Agent OS...', '["routing","chat","help"]', 'brain');
seedAgent.run('coder', 'Claude Code', 'Programacao, analise, debugging, arquitetura', 'claude-opus-4-6', 'acpx', 'npx -y @zed-industries/claude-agent-acp', null, '["code","analysis","planning","debugging"]', 'code');
seedAgent.run('sql', 'SQL Agent', 'Queries SQL, Supabase, information_schema', 'agent-os-1.5b', 'api', null, 'You are a command adapter. Output ONLY valid JSON.', '["sql","database","supabase"]', 'database');

// ============ QUERY HELPERS ============

export const queries = {
  // Providers
  getProviders: db.prepare(`SELECT * FROM providers ORDER BY name`),
  getProvider: db.prepare(`SELECT * FROM providers WHERE id = ?`),
  updateProviderAuth: db.prepare(`UPDATE providers SET auth_value = ?, auth_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),
  updateProviderConfig: db.prepare(`UPDATE providers SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),

  // Models
  getModels: db.prepare(`SELECT m.*, p.name as provider_name, p.auth_status FROM models m JOIN providers p ON m.provider_id = p.id WHERE m.active = 1 ORDER BY p.name, m.name`),
  getModel: db.prepare(`SELECT * FROM models WHERE id = ?`),
  getModelsByProvider: db.prepare(`SELECT * FROM models WHERE provider_id = ? AND active = 1`),
  insertModel: db.prepare(`INSERT INTO models (id, provider_id, name, model_id, type, endpoint, capabilities) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  updateModel: db.prepare(`UPDATE models SET name = ?, model_id = ?, type = ?, endpoint = ?, capabilities = ?, active = ? WHERE id = ?`),

  // Agents
  getAgents: db.prepare(`SELECT a.*, m.name as model_name, m.model_id as model_ref, p.name as provider_name, p.auth_status as provider_auth FROM agents a LEFT JOIN models m ON a.model_id = m.id LEFT JOIN providers p ON m.provider_id = p.id WHERE a.active = 1 ORDER BY a.name`),
  getAgent: db.prepare(`SELECT a.*, m.name as model_name, m.model_id as model_ref FROM agents a LEFT JOIN models m ON a.model_id = m.id WHERE a.id = ?`),
  insertAgent: db.prepare(`INSERT INTO agents (id, name, description, model_id, agent_type, acpx_command, system_prompt, capabilities, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  updateAgent: db.prepare(`UPDATE agents SET name = ?, description = ?, model_id = ?, agent_type = ?, acpx_command = ?, system_prompt = ?, capabilities = ?, icon = ?, active = ? WHERE id = ?`),
  updateAgentModel: db.prepare(`UPDATE agents SET model_id = ? WHERE id = ?`),
  deleteAgent: db.prepare(`UPDATE agents SET active = 0 WHERE id = ?`),

  // Apps
  getApps: db.prepare(`SELECT a.*, ag.name as agent_name, ag.model_id FROM apps a LEFT JOIN agents ag ON a.agent_id = ag.id WHERE a.active = 1 ORDER BY a.dock_pinned DESC, a.name`),
  updateAppAgent: db.prepare(`UPDATE apps SET agent_id = ? WHERE id = ?`),

  // Conversations
  getConversations: db.prepare(`SELECT c.*, a.name as agent_name, (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count FROM conversations c LEFT JOIN agents a ON c.agent_id = a.id ORDER BY c.updated_at DESC LIMIT ?`),
  getConversation: db.prepare(`SELECT * FROM conversations WHERE id = ?`),
  getConversationBySession: db.prepare(`SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`),
  createConversation: db.prepare(`INSERT INTO conversations (agent_id, session_id, title) VALUES (?, ?, ?)`),
  updateConversationTitle: db.prepare(`UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),

  // Messages
  getMessages: db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`),
  getRecentMessages: db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`),
  insertMessage: db.prepare(`INSERT INTO messages (conversation_id, role, content, agent_id, model_id, routing, tokens_input, tokens_output, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),

  // Agent files
  insertFile: db.prepare(`INSERT INTO agent_files (conversation_id, message_id, file_path, action) VALUES (?, ?, ?, ?)`),
  getFilesByConversation: db.prepare(`SELECT * FROM agent_files WHERE conversation_id = ? ORDER BY created_at DESC`),
};

// ============ API ROUTES ============

export function createDatabaseAPI(app) {
  // --- Providers ---
  app.get('/api/db/providers', (_req, res) => {
    const providers = queries.getProviders.all();
    // Don't expose auth_value
    res.json(providers.map(p => ({ ...p, auth_value: p.auth_value ? '***' : null })));
  });

  app.get('/api/db/providers/:id', (req, res) => {
    const p = queries.getProvider.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Provider not found' });
    res.json({ ...p, auth_value: p.auth_value ? '***' : null });
  });

  app.post('/api/db/providers/:id/auth', (req, res) => {
    const { auth_value } = req.body;
    if (!auth_value) return res.status(400).json({ error: 'auth_value required' });
    queries.updateProviderAuth.run(auth_value, 'authenticated', req.params.id);
    res.json({ ok: true });
  });

  // --- Provider status check (uses launcher modules) ---
  app.get('/api/db/providers/:id/status', async (req, res) => {
    const id = req.params.id;
    try {
      if (id === 'anthropic') {
        const { execSync } = await import('child_process');
        try {
          const out = execSync('sudo -u claude claude auth status 2>&1', { timeout: 10000 }).toString();
          const loggedIn = out.includes('loggedIn') || out.includes('true');
          const version = execSync('claude --version 2>&1', { timeout: 5000 }).toString().trim();
          if (loggedIn) queries.updateProviderAuth.run('oauth', 'authenticated', 'anthropic');
          res.json({ installed: true, version, authenticated: loggedIn });
        } catch {
          res.json({ installed: false, authenticated: false });
        }
      } else if (id === 'google') {
        const { execSync } = await import('child_process');
        try {
          const version = execSync('gemini --version 2>&1', { timeout: 5000 }).toString().trim();
          res.json({ installed: true, version, authenticated: false }); // TODO: check auth
        } catch {
          res.json({ installed: false, authenticated: false });
        }
      } else if (id === 'local') {
        try {
          const r = await fetch('http://localhost:8080/health');
          res.json({ installed: true, authenticated: true, healthy: r.ok });
        } catch {
          res.json({ installed: false, authenticated: false, healthy: false });
        }
      } else if (id === 'huggingface') {
        const p = queries.getProvider.get('huggingface');
        const hasToken = !!(p?.auth_value || process.env.HF_TOKEN);
        res.json({ installed: true, authenticated: hasToken });
      } else {
        const p = queries.getProvider.get(id);
        res.json({ installed: true, authenticated: p?.auth_status === 'authenticated' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Provider install ---
  app.post('/api/db/providers/:id/install', async (req, res) => {
    const p = queries.getProvider.get(req.params.id);
    if (!p?.install_command) return res.status(400).json({ error: 'No install command' });
    try {
      const { execSync } = await import('child_process');
      const out = execSync(p.install_command, { timeout: 120000 }).toString();
      res.json({ ok: true, output: out });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Models ---
  app.get('/api/db/models', (_req, res) => {
    res.json(queries.getModels.all());
  });

  app.post('/api/db/models', (req, res) => {
    const { id, provider_id, name, model_id, type, endpoint, capabilities } = req.body;
    try {
      queries.insertModel.run(id, provider_id, name, model_id, type || 'cloud', endpoint, JSON.stringify(capabilities || []));
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Agents ---
  app.get('/api/db/agents', (_req, res) => {
    res.json(queries.getAgents.all());
  });

  app.get('/api/db/agents/:id', (req, res) => {
    const a = queries.getAgent.get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Agent not found' });
    res.json(a);
  });

  app.post('/api/db/agents', (req, res) => {
    const { id, name, description, model_id, agent_type, acpx_command, system_prompt, capabilities, icon } = req.body;
    try {
      queries.insertAgent.run(id, name, description, model_id, agent_type || 'smol', acpx_command, system_prompt, JSON.stringify(capabilities || []), icon || 'bot');
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/db/agents/:id', (req, res) => {
    const { name, description, model_id, agent_type, acpx_command, system_prompt, capabilities, icon, active } = req.body;
    queries.updateAgent.run(name, description, model_id, agent_type, acpx_command, system_prompt, JSON.stringify(capabilities || []), icon, active ?? 1, req.params.id);
    res.json({ ok: true });
  });

  app.patch('/api/db/agents/:id/model', (req, res) => {
    const { model_id } = req.body;
    queries.updateAgentModel.run(model_id, req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/db/agents/:id', (req, res) => {
    queries.deleteAgent.run(req.params.id);
    res.json({ ok: true });
  });

  // --- Apps ---
  app.get('/api/db/apps', (_req, res) => {
    res.json(queries.getApps.all());
  });

  app.patch('/api/db/apps/:id/agent', (req, res) => {
    const { agent_id } = req.body;
    queries.updateAppAgent.run(agent_id, req.params.id);
    res.json({ ok: true });
  });

  // --- Conversations ---
  app.get('/api/db/conversations', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(queries.getConversations.all(limit));
  });

  app.get('/api/db/conversations/:id/messages', (req, res) => {
    res.json(queries.getMessages.all(req.params.id));
  });

  app.post('/api/db/conversations', (req, res) => {
    const { agent_id, session_id, title } = req.body;
    const info = queries.createConversation.run(agent_id, session_id, title);
    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.post('/api/db/conversations/:id/messages', (req, res) => {
    const { role, content, agent_id, model_id, routing, tokens_input, tokens_output, duration_ms } = req.body;
    const info = queries.insertMessage.run(req.params.id, role, content, agent_id, model_id, JSON.stringify(routing), tokens_input, tokens_output, duration_ms);
    res.status(201).json({ id: info.lastInsertRowid });
  });

  console.log(`Database ready: ${DB_PATH}`);
}

export default db;
