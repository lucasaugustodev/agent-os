/**
 * Memory Organizer - Llama 70B analisa cada interacao e organiza:
 * - Detecta secrets/keys → salva no vault
 * - Detecta erros → registra e sugere solucao
 * - Detecta decisoes → documenta na knowledge base
 * - Detecta padroes → registra pra reusar
 * Roda em background apos cada mensagem, nao bloqueia o usuario.
 */

const HF_API = 'https://router.huggingface.co/groq/openai/v1/chat/completions';
const HF_MODEL = 'llama-3.3-70b-versatile';

async function askLlama(systemPrompt, userContent, token) {
  const r = await fetch(HF_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
    }),
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============ DETECTORS ============

const KEY_PATTERNS = [
  { pattern: /\b(sk-[a-zA-Z0-9_-]{20,})\b/g, type: 'openai_key' },
  { pattern: /\b(sk-or-v1-[a-f0-9]{64})\b/g, type: 'openrouter_key' },
  { pattern: /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g, type: 'anthropic_key' },
  { pattern: /\b(hf_[a-zA-Z0-9]{30,})\b/g, type: 'huggingface_token' },
  { pattern: /\b(sbp_[a-f0-9]{40,})\b/g, type: 'supabase_token' },
  { pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g, type: 'github_token' },
  { pattern: /\b(gho_[a-zA-Z0-9]{36})\b/g, type: 'github_oauth' },
  { pattern: /\b(xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,})\b/g, type: 'slack_token' },
  { pattern: /\b([A-Z0-9]{32,})\b/g, type: 'api_key', minEntropy: true },
  { pattern: /\b(eyJ[a-zA-Z0-9_-]{50,}\.eyJ[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]{20,})\b/g, type: 'jwt_token' },
];

function detectKeys(text) {
  const found = [];
  for (const { pattern, type, minEntropy } of KEY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      // Skip if it's just a common word or too short
      if (key.length < 20) continue;
      // Skip low-entropy strings (all same char, etc)
      if (minEntropy) {
        const unique = new Set(key).size;
        if (unique < 10) continue;
      }
      found.push({ key, type });
    }
  }
  return found;
}

function detectErrors(text) {
  const errorPatterns = [
    /error[:\s]+(.{10,100})/gi,
    /\[error\]\s+(.{10,100})/gi,
    /failed[:\s]+(.{10,100})/gi,
    /exception[:\s]+(.{10,100})/gi,
    /traceback.{0,50}([\s\S]{10,200})/gi,
  ];
  const errors = [];
  for (const pat of errorPatterns) {
    const regex = new RegExp(pat.source, pat.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      errors.push(match[1].trim().substring(0, 200));
    }
  }
  return [...new Set(errors)];
}

// ============ ORGANIZER ============

export async function organizeMessage(db, message, conversationId, agentId) {
  const token = process.env.HF_TOKEN;
  if (!token) return;

  const text = message.content || message;

  // 1. Detect and save keys/secrets
  const keys = detectKeys(text);
  if (keys.length > 0) {
    const insertVault = db.prepare(
      `INSERT OR IGNORE INTO vault (key_name, key_value, category, description, source) VALUES (?, ?, ?, ?, ?)`
    );
    for (const { key, type } of keys) {
      const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
      try {
        // Ask Llama to identify what this key is for
        const desc = await askLlama(
          'Identifique em 1 frase curta o que esta chave/token e para que serve. Responda so a descricao, nada mais.',
          `Tipo: ${type}\nChave: ${masked}\nContexto: ${text.substring(0, 300)}`,
          token
        ).catch(() => type);
        insertVault.run(type + '_' + Date.now(), key, type, desc, 'chat_detection');
        console.log(`[VAULT] Saved ${type}: ${masked}`);
      } catch {}
    }
  }

  // 2. Detect errors
  const errors = detectErrors(text);
  if (errors.length > 0) {
    const insertError = db.prepare(
      `INSERT INTO agent_errors (conversation_id, agent_id, error_type, error_message) VALUES (?, ?, ?, ?)`
    );
    for (const err of errors) {
      try {
        insertError.run(conversationId, agentId, 'detected', err);
        console.log(`[ERROR] Detected: ${err.substring(0, 60)}...`);
      } catch {}
    }
  }

  // 3. Classify and create knowledge if important
  try {
    const classification = await askLlama(
      `Analise esta mensagem e responda SOMENTE com um JSON valido (sem markdown):
{"important": true/false, "type": "error_resolution|decision|pattern|info|none", "title": "titulo curto", "tags": ["tag1","tag2"]}
Marque important=true se contem: decisao tecnica, solucao de erro, padrao util, configuracao importante, credencial, ou aprendizado significativo.`,
      text.substring(0, 1500),
      token
    );

    let parsed;
    try {
      let json = classification.trim();
      if (json.startsWith('```')) json = json.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(json);
    } catch { return; }

    if (parsed.important && parsed.type !== 'none') {
      // Generate knowledge document
      const doc = await askLlama(
        `Crie um documento de conhecimento estruturado baseado nesta interacao.
Formato: titulo, tipo (${parsed.type}), resumo em 2-3 frases, detalhes tecnicos, e tags.
Responda em portugues. Seja conciso e pratico.`,
        text.substring(0, 2000),
        token
      );

      const insertKnowledge = db.prepare(
        `INSERT INTO knowledge (title, type, tags, content, agent_id, conversation_id, source_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      insertKnowledge.run(
        parsed.title,
        parsed.type,
        JSON.stringify(parsed.tags || []),
        doc,
        agentId,
        conversationId,
        'auto_detected'
      );
      console.log(`[KNOWLEDGE] Created: ${parsed.title} (${parsed.type})`);
    }
  } catch {}
}

// ============ QUERY KNOWLEDGE ============

export function searchKnowledge(db, query, limit = 5) {
  // Simple text search (Basic Memory adds semantic search later)
  const stmt = db.prepare(
    `SELECT * FROM knowledge WHERE content LIKE ? OR title LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT ?`
  );
  const pattern = `%${query}%`;
  return stmt.all(pattern, pattern, pattern, limit);
}

export function getVaultKeys(db, category = null) {
  if (category) {
    return db.prepare(`SELECT id, key_name, category, description, source, detected_at FROM vault WHERE category = ? ORDER BY detected_at DESC`).all(category);
  }
  return db.prepare(`SELECT id, key_name, category, description, source, detected_at FROM vault ORDER BY detected_at DESC`).all();
}

export function getVaultKeyValue(db, id) {
  return db.prepare(`SELECT * FROM vault WHERE id = ?`).get(id);
}

// ============ API ROUTES ============



// ============ MEMORY FILE ACCESS (for all agents) ============

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = '/opt/agent-os/memory';

export function searchMemoryFiles(query, limit = 5) {
  if (!existsSync(MEMORY_DIR)) return [];
  const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md'));
  const results = [];
  const q = query.toLowerCase();

  for (const file of files) {
    try {
      const content = readFileSync(join(MEMORY_DIR, file), 'utf8');
      const contentLower = content.toLowerCase();

      // Score by keyword matches
      const words = q.split(/\s+/);
      let score = 0;
      for (const word of words) {
        if (word.length < 3) continue;
        const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      }

      if (score > 0) {
        // Extract title from frontmatter
        const titleMatch = content.match(/title:\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');

        results.push({ file, title, score, content: content.substring(0, 500) });
      }
    } catch {}
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getAllMemoryFiles() {
  if (!existsSync(MEMORY_DIR)) return [];
  return readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(MEMORY_DIR, f), 'utf8');
      const titleMatch = content.match(/title:\s*(.+)/);
      const typeMatch = content.match(/type:\s*(.+)/);
      const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
      return {
        file: f,
        title: titleMatch ? titleMatch[1].trim() : f.replace('.md', ''),
        type: typeMatch ? typeMatch[1].trim() : 'note',
        tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
      };
    });
}

export async function writeMemoryFile(filename, content) {
  const { writeFileSync } = await import('fs');
  writeFileSync(join(MEMORY_DIR, filename), content, 'utf8');
}


export function createMemoryAPI(app, db) {
  // Knowledge
  app.get('/api/memory/knowledge', (req, res) => {
    const q = req.query.q;
    if (q) {
      res.json(searchKnowledge(db, q));
    } else {
      const all = db.prepare('SELECT id, title, type, tags, agent_id, created_at FROM knowledge ORDER BY created_at DESC LIMIT 50').all();
      res.json(all);
    }
  });

  app.get('/api/memory/knowledge/:id', (req, res) => {
    const k = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(req.params.id);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json(k);
  });

  // Vault (keys/secrets)
  app.get('/api/memory/vault', (req, res) => {
    const keys = getVaultKeys(db, req.query.category);
    // Mask values in response
    res.json(keys);
  });

  app.get('/api/memory/vault/:id', (req, res) => {
    const k = getVaultKeyValue(db, req.params.id);
    if (!k) return res.status(404).json({ error: 'Not found' });
    // Mask the key value
    res.json({ ...k, key_value: k.key_value.substring(0, 8) + '...' + k.key_value.substring(k.key_value.length - 4) });
  });

  app.get('/api/memory/vault/:id/reveal', (req, res) => {
    const k = getVaultKeyValue(db, req.params.id);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json(k);
  });

  app.post('/api/memory/vault', (req, res) => {
    const { key_name, key_value, category, description, project_id } = req.body;
    if (!key_name || !key_value) return res.status(400).json({ error: 'key_name and key_value required' });
    const stmt = db.prepare('INSERT INTO vault (key_name, key_value, category, project_id, description, source) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(key_name, key_value, category || 'general', project_id, description, 'manual');
    res.status(201).json({ id: info.lastInsertRowid });
  });

  // Errors
  app.get('/api/memory/errors', (req, res) => {
    const resolved = req.query.resolved === 'true' ? 1 : 0;
    const errors = db.prepare('SELECT * FROM agent_errors WHERE resolved = ? ORDER BY created_at DESC LIMIT 50').all(resolved);
    res.json(errors);
  });

  app.post('/api/memory/errors/:id/resolve', async (req, res) => {
    const { resolution } = req.body;
    db.prepare('UPDATE agent_errors SET resolved = 1, resolution = ? WHERE id = ?').run(resolution, req.params.id);

    // Auto-generate knowledge from resolved error
    const error = db.prepare('SELECT * FROM agent_errors WHERE id = ?').get(req.params.id);
    if (error) {
      try {
        const token = process.env.HF_TOKEN;
        const doc = await askLlama(
          'Crie um documento de conhecimento sobre este erro resolvido. Inclua: erro, causa, solucao. Seja conciso. Portugues.',
          `Erro: ${error.error_message}\nResolucao: ${resolution}`,
          token
        );
        db.prepare('INSERT INTO knowledge (title, type, tags, content, agent_id, source_type) VALUES (?, ?, ?, ?, ?, ?)')
          .run(`Erro resolvido: ${error.error_message.substring(0, 50)}`, 'error_resolution', '["error","fix"]', doc, error.agent_id, 'error_resolution');
      } catch {}
    }

    res.json({ ok: true });
  });

  // Skills
  app.get('/api/memory/skills', (_req, res) => {
    res.json(db.prepare('SELECT * FROM skills ORDER BY category, name').all());
  });

  app.post('/api/memory/skills', (req, res) => {
    const { id, name, description, category, instructions, examples, restrictions } = req.body;
    db.prepare('INSERT OR REPLACE INTO skills (id, name, description, category, instructions, examples, restrictions) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, description, category, instructions, JSON.stringify(examples || []), restrictions);
    res.status(201).json({ ok: true });
  });

  // Agent-skill links
  app.get('/api/memory/agents/:id/skills', (req, res) => {
    const skills = db.prepare(
      'SELECT s.*, ask.priority FROM skills s JOIN agent_skills ask ON s.id = ask.skill_id WHERE ask.agent_id = ? ORDER BY ask.priority'
    ).all(req.params.id);
    res.json(skills);
  });

  app.post('/api/memory/agents/:id/skills', (req, res) => {
    const { skill_id, priority } = req.body;
    db.prepare('INSERT OR REPLACE INTO agent_skills (agent_id, skill_id, priority) VALUES (?, ?, ?)')
      .run(req.params.id, skill_id, priority || 0);
    res.json({ ok: true });
  });

  // Projects
  app.get('/api/memory/projects', (_req, res) => {
    res.json(db.prepare('SELECT * FROM project_contexts WHERE active = 1 ORDER BY name').all());
  });

  app.post('/api/memory/projects', (req, res) => {
    const { id, name, path, description, tech_stack, conventions } = req.body;
    db.prepare('INSERT OR REPLACE INTO project_contexts (id, name, path, description, tech_stack, conventions) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, path, description, JSON.stringify(tech_stack || []), conventions);
    res.status(201).json({ ok: true });
  });


  // Memory files (markdown - accessible by all agents)
  app.get('/api/memory/files', (_req, res) => {
    res.json(getAllMemoryFiles());
  });

  app.get('/api/memory/search', (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'q parameter required' });

    // Search both SQLite knowledge and markdown files
    const dbResults = searchKnowledge(db, q);
    const fileResults = searchMemoryFiles(q);

    res.json({
      knowledge: dbResults,
      files: fileResults,
    });
  });

  app.get('/api/memory/files/:filename', (req, res) => {
    const filePath = join('/opt/agent-os/memory', req.params.filename);
    try {
      const content = readFileSync(filePath, 'utf8');
      res.json({ filename: req.params.filename, content });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  console.log('Memory API loaded');
}
