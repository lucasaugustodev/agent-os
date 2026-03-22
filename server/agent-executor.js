/**
 * Agent Executor - Single canonical way to execute any agent type.
 * Loads config from database, executes based on type (smol/cli/api/local).
 * All other modules call this instead of reimplementing.
 */

import { spawn } from 'child_process';

let _db = null;
let _agentCache = {};
let _modelCache = {};
let _providerCache = {};

// ============ INIT ============

export function initExecutor(db) {
  _db = db;
  refreshCache();
}

export function refreshCache() {
  if (!_db) return;
  try {
    const agents = _db.prepare('SELECT a.*, m.model_id as model_ref, m.endpoint as model_endpoint, m.type as model_type, p.id as provider_id, p.auth_value, p.base_url FROM agents a LEFT JOIN models m ON a.model_id = m.id LEFT JOIN providers p ON m.provider_id = p.id WHERE a.active = 1').all();
    _agentCache = {};
    for (const a of agents) _agentCache[a.id] = a;

    const models = _db.prepare('SELECT * FROM models WHERE active = 1').all();
    _modelCache = {};
    for (const m of models) _modelCache[m.id] = m;

    const providers = _db.prepare('SELECT * FROM providers').all();
    _providerCache = {};
    for (const p of providers) _providerCache[p.id] = p;
  } catch (e) {
    console.error('[EXECUTOR] Cache refresh error:', e.message);
  }
}

// ============ GET AGENT ============

export function getAgent(agentId) {
  return _agentCache[agentId] || null;
}

export function getAllAgents() {
  return Object.values(_agentCache);
}

export function getGestorConfig() {
  const gestor = _agentCache['gestor'];
  const model = gestor ? _modelCache[gestor.model_id] : null;
  return {
    endpoint: model?.endpoint || process.env.HF_ENDPOINT || 'https://router.huggingface.co/groq/openai/v1/chat/completions',
    model: model?.model_id || 'llama-3.3-70b-versatile',
    token: process.env.HF_TOKEN,
    systemPrompt: gestor?.system_prompt || '',
  };
}

// ============ EXECUTE ============

/**
 * Execute an agent with a prompt. Returns the result string.
 * @param {string} agentId - Agent ID from registry
 * @param {string} prompt - User prompt
 * @param {object} options - { threadContext, threadId, stream }
 * @returns {Promise<string>} result
 */
export async function executeAgent(agentId, prompt, options = {}) {
  const agent = _agentCache[agentId];
  if (!agent) throw new Error(`Agent "${agentId}" not found`);

  const type = agent.agent_type || 'smol';

  switch (type) {
    case 'smol':
      return executeSmolAgent(agent, prompt, options);
    case 'cli':
    case 'acpx':
      return executeCliAgent(agent, prompt, options);
    case 'api':
      if (agent.model_type === 'local' || agent.model_endpoint?.includes('localhost')) {
        return executeLocalAgent(agent, prompt, options);
      }
      return executeApiAgent(agent, prompt, options);
    case 'local':
      return executeLocalAgent(agent, prompt, options);
    default:
      return executeSmolAgent(agent, prompt, options);
  }
}

// ============ SMOL AGENT (HF/Groq/OpenRouter API) ============

async function executeSmolAgent(agent, prompt, options) {
  const model = _modelCache[agent.model_id];
  const endpoint = model?.endpoint || getGestorConfig().endpoint;
  const modelId = model?.model_id || 'llama-3.3-70b-versatile';
  const token = process.env.HF_TOKEN;

  const systemPrompt = agent.system_prompt || 'You are a helpful assistant.';
  const messages = [
    { role: 'system', content: systemPrompt + (options.threadContext || '') },
    { role: 'user', content: prompt },
  ];

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: false,
    }),
  });

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

// ============ CLI AGENT (ACPX) ============

function executeCliAgent(agent, prompt, options) {
  return new Promise((resolve, reject) => {
    const safePrompt = prompt.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const shellCmd = `stdbuf -oL sudo -u claude bash -c 'cd /home/claude && stdbuf -oL acpx claude exec "${safePrompt}"' 2>&1`;
    const proc = spawn('bash', ['-c', shellCmd], { timeout: 180000 });

    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.on('close', (code) => {
      // Clean ACPX framework lines
      const lines = output.split('\n').filter(l => {
        const t = l.trim();
        return t && !t.startsWith('[acpx]') && !t.startsWith('[client]') && !t.startsWith('[error]') && !t.startsWith('[done]') && !t.startsWith('[thinking]') && !t.startsWith('\u26a0');
      });
      resolve(lines.join('\n').trim() || 'Agent completed');
    });
    proc.on('error', (err) => reject(err));
  });
}

// ============ CLI AGENT STREAMING (ACPX with callbacks) ============

export function executeCliAgentStream(agent, prompt, options = {}) {
  const safePrompt = prompt.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const shellCmd = `stdbuf -oL sudo -u claude bash -c 'cd /home/claude && stdbuf -oL acpx claude exec "${safePrompt}"' 2>&1`;
  const proc = spawn('bash', ['-c', shellCmd], { timeout: 180000, env: { ...process.env, PYTHONUNBUFFERED: '1' } });

  return {
    process: proc,
    onData: (cb) => {
      proc.stdout.on('data', (d) => {
        const text = d.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          if (t.includes('initialize') || t.includes('session/new')) cb('status', 'Conectando ao Claude...');
          else if (t.startsWith('[thinking]')) cb('status', 'Claude pensando...');
          else if (t.includes('tool_use') || t.includes('[tool]')) cb('status', 'Claude usando ferramentas...');
          else if (!t.startsWith('[') && !t.startsWith('\u26a0')) cb('status', 'Claude respondendo...');
        }
      });
    },
    onClose: (cb) => {
      proc.on('close', (code) => {
        let output = '';
        // Collect all stdout
        proc.stdout.removeAllListeners('data');
        cb(code);
      });
    },
    getOutput: () => {
      // This needs to accumulate during streaming
      let fullOutput = '';
      proc.stdout.on('data', (d) => { fullOutput += d.toString(); });
      return () => {
        const lines = fullOutput.split('\n').filter(l => {
          const t = l.trim();
          return t && !t.startsWith('[acpx]') && !t.startsWith('[client]') && !t.startsWith('[error]') && !t.startsWith('[done]') && !t.startsWith('[thinking]') && !t.startsWith('\u26a0');
        });
        return lines.join('\n').trim() || 'Claude completed';
      };
    },
    cancel: () => proc.kill('SIGTERM'),
  };
}

// ============ LOCAL AGENT (llama-server) ============

async function executeLocalAgent(agent, prompt, options) {
  const model = _modelCache[agent.model_id];
  const endpoint = model?.endpoint || 'http://localhost:8080';
  const systemPrompt = agent.system_prompt || 'You are a command adapter. Output ONLY valid JSON. No explanation.';

  const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${prompt}${options.threadContext ? '\nContext: ' + options.threadContext.substring(0, 500) : ''}<|im_end|>\n<|im_start|>assistant\n`;

  const resp = await fetch(`${endpoint}/v1/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: fullPrompt,
      max_tokens: 200,
      temperature: 0.1,
      stop: ['<|im_end|>'],
    }),
  });

  const data = await resp.json();
  return data.choices[0].text.trim();
}

// ============ API AGENT (OpenAI-compatible) ============

async function executeApiAgent(agent, prompt, options) {
  const model = _modelCache[agent.model_id];
  const provider = _providerCache[model?.provider_id];
  const endpoint = model?.endpoint || provider?.base_url || 'https://api.openai.com/v1/chat/completions';
  const apiKey = provider?.auth_value || process.env[`${(provider?.id || '').toUpperCase()}_API_KEY`];

  const systemPrompt = agent.system_prompt || 'You are a helpful assistant.';

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model?.model_id || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt + (options.threadContext || '') },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
    }),
  });

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

// ============ HF CLIENT (utility) ============

export async function askLlm(prompt, options = {}) {
  const config = getGestorConfig();
  const resp = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.3,
      stream: options.stream || false,
    }),
  });

  if (options.stream) return resp;

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============ ROUTING ============

export async function routeMessage(message, threadContext = '') {
  const agentList = getAllAgents().map(a => `- "${a.id}": ${a.description || a.name}`).join('\n');

  const systemPrompt = `You are a task router. Analyze the user message and respond with ONLY a JSON object:
{"agent": "<agent_id>", "reason": "<brief reason>", "rewritten_prompt": "<optimized prompt>"}

Available agents:
${agentList}

Rules:
- code/files/programming → agent with code capability
- tables/SQL/database → agent with sql capability
- general questions → "gestor"
- Always respond in valid JSON only`;

  try {
    const result = await askLlm(message + threadContext, { systemPrompt, maxTokens: 200, temperature: 0.1 });
    let json = result.trim();
    if (json.startsWith('```')) json = json.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(json);
  } catch {
    return { agent: 'gestor', reason: 'routing failed', rewritten_prompt: message };
  }
}

console.log('[EXECUTOR] Agent executor module loaded');
