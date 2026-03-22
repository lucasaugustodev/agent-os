/**
 * Agent OS Orchestrator
 *
 * Gestor central que roda na Inference API gratuita do HuggingFace (Llama 3.3 70B).
 * Recebe mensagens do usuario, classifica a intencao, e roteia para o agente correto
 * via ACPX (Agent Client Protocol).
 *
 * Agentes disponiveis:
 * - claude: Claude Code via ACP (coding, analysis, planning)
 * - sql: Modelo local 1.5B via llama-server (queries SQL, Supabase)
 * - direct: Resposta direta do gestor (duvidas gerais, explicacoes)
 */

import { spawn } from 'child_process';
import { getAllAgents, executeAgent as execAgent, routeMessage as routeMsg, askLlm as askLlmUtil } from './agent-executor.js';
import { searchMemoryFiles } from './memory-organizer.js';
import { EventEmitter } from 'events';

// ============ CONFIG ============

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL = 'llama-3.3-70b-versatile';
const HF_API = 'https://router.huggingface.co/groq/openai/v1/chat/completions';

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8080';

// Agent registry loaded dynamically from database via agent-executor
function getAgentRegistry() {
  const agents = getAllAgents();
  const registry = {};
  for (const a of agents) {
    registry[a.id] = { name: a.name, description: a.description, capabilities: JSON.parse(a.capabilities || '[]') };
  }
  registry['direct'] = { name: 'Gestor (Llama 70B)', description: 'Duvidas gerais', capabilities: ['chat'] };
  return registry;
}
const AGENT_REGISTRY = getAgentRegistry();

// ============ HF INFERENCE (Gestor) ============

async function askGestor(messages, options = {}) {
  const response = await fetch(HF_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.3,
      stream: options.stream || false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF API error ${response.status}: ${err}`);
  }

  if (options.stream) {
    return response.body;
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============ ROUTING ============

const ROUTING_SYSTEM_PROMPT = `You are a task router for Agent OS. Analyze the user message and respond with ONLY a JSON object (no markdown, no explanation):

{"agent": "<agent_id>", "reason": "<brief reason>", "rewritten_prompt": "<optimized prompt for the agent>"}

Available agents:
- "claude": For coding tasks, code analysis, architecture, debugging, file operations, git, refactoring
- "sql": For database queries, SQL, Supabase operations, listing tables/columns, data analysis
- "direct": For general questions, explanations, help, conversation, anything not code or database

Rules:
- If the user asks about code, files, or programming → "claude"
- If the user mentions tables, SQL, queries, database, Supabase → "sql"
- If the user asks general questions or wants explanation → "direct"
- Always respond in valid JSON only`;

async function routeMessage(userMessage) {
  try {
    // Search memory for relevant context
    let memoryContext = '';
    try {
      const memories = searchMemoryFiles(userMessage, 3);
      if (memories.length > 0) {
        memoryContext = '\n\nRelevant knowledge from memory:\n' + memories.map(m => `- ${m.title}: ${m.content.substring(0, 200)}`).join('\n');
      }
    } catch {}

    const result = await askGestor([
      { role: 'system', content: ROUTING_SYSTEM_PROMPT + memoryContext },
      { role: 'user', content: userMessage },
    ], { maxTokens: 200, temperature: 0.1 });

    // Parse JSON from response (handle markdown wrapping)
    let json = result.trim();
    if (json.startsWith('```')) {
      json = json.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    return JSON.parse(json);
  } catch (e) {
    console.error('Routing failed, defaulting to direct:', e.message);
    return { agent: 'direct', reason: 'routing failed', rewritten_prompt: userMessage };
  }
}

// ============ AGENT EXECUTORS ============

// Execute via ACPX (Claude Code)
async function executeAcpx(sessionName, prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-u', 'claude', 'acpx', 'claude', '-s', sessionName, prompt];
    const proc = spawn('sudo', args, {
      cwd: '/home/claude',
      timeout: 120000,
      env: { ...process.env, HOME: '/home/claude' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`acpx exited ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// Execute via ACPX streaming (returns EventEmitter)
function executeAcpxStream(sessionName, prompt) {
  const emitter = new EventEmitter();
  const args = ['-u', 'claude', 'acpx', 'claude', '-s', sessionName, '--format', 'json', prompt];
  const proc = spawn('sudo', args, {
    cwd: '/home/claude',
    timeout: 120000,
    env: { ...process.env, HOME: '/home/claude' },
  });

  let buffer = '';
  proc.stdout.on('data', (d) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) {
        try {
          const msg = JSON.parse(line);
          emitter.emit('message', msg);
        } catch {
          emitter.emit('text', line);
        }
      }
    }
  });

  proc.stderr.on('data', (d) => {
    emitter.emit('stderr', d.toString());
  });

  proc.on('close', (code) => {
    emitter.emit('done', { code });
  });

  proc.on('error', (err) => {
    emitter.emit('error', err);
  });

  emitter.cancel = () => {
    proc.kill('SIGTERM');
  };

  return emitter;
}

// Execute via local llama-server (SQL Agent)
async function executeLocalLLM(prompt) {
  const fullPrompt = `<|im_start|>system\nYou are a command adapter. Output ONLY valid JSON. No explanation.<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

  const response = await fetch(`${LOCAL_LLM_URL}/v1/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: fullPrompt,
      max_tokens: 200,
      temperature: 0.1,
      stop: ['<|im_end|>'],
    }),
  });

  const data = await response.json();
  return data.choices[0].text.trim();
}

// Execute direct response from gestor
async function executeDirect(prompt, conversationHistory = []) {
  // Search memory for context
  let memoryContext = '';
  try {
    const memories = searchMemoryFiles(prompt, 3);
    if (memories.length > 0) {
      memoryContext = '\n\nConhecimento da memoria do sistema:\n' + memories.map(m => `- ${m.title}: ${m.content.substring(0, 300)}`).join('\n');
    }
  } catch {}

  const messages = [
    {
      role: 'system',
      content: `Voce e o assistente do Agent OS, um sistema operacional de agentes IA da Hub Formaturas. Responda em portugues de forma clara e amigavel. Voce pode explicar como o sistema funciona, ajudar com duvidas, e orientar o usuario.

O Agent OS tem:
- Browser: navegador web integrado
- Terminal: sessoes de terminal com IA
- Inbox: caixa de tarefas (em dev)
- Mission Control: kanban de tarefas (em dev)
- Agents: gestao de agentes IA (em dev)
- Finder: explorador de arquivos (em dev)
- Settings: configuracoes (em dev)

Agentes disponiveis:
- Claude Code: para programacao, analise de codigo, debugging
- SQL Agent: modelo local 1.5B treinado para queries SQL/Supabase
- Gestor: voce, para duvidas gerais e orientacao`,
    },
    ...conversationHistory,
    { role: 'user', content: prompt },
  ];

  return await askGestor(messages, { maxTokens: 1024, temperature: 0.7 });
}

// ============ ORCHESTRATOR ============

class Orchestrator extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // sessionId -> { history, acpxSession }
    this.activeAgents = new Map();
  }

  async processMessage(sessionId, userMessage) {
    // Get or create session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [], acpxSession: `agentOS-${sessionId}` });
    }
    const session = this.sessions.get(sessionId);

    // Step 1: Route the message
    this.emit('status', { sessionId, status: 'routing', message: 'Analisando sua mensagem...' });
    const routing = await routeMessage(userMessage);
    this.emit('routing', { sessionId, routing });

    // Step 2: Execute with the chosen agent
    const agent = AGENT_REGISTRY[routing.agent] || AGENT_REGISTRY.direct;
    this.emit('status', { sessionId, status: 'executing', agent: agent.name, message: `Enviando para ${agent.name}...` });

    let result;
    try {
      switch (routing.agent) {
        case 'claude':
          result = await executeAcpx(session.acpxSession, routing.rewritten_prompt || userMessage);
          break;

        case 'sql':
          result = await executeLocalLLM(routing.rewritten_prompt || userMessage);
          break;

        case 'direct':
        default:
          result = await executeDirect(routing.rewritten_prompt || userMessage, session.history);
          break;
      }
    } catch (err) {
      result = `Erro ao executar ${agent.name}: ${err.message}`;
      this.emit('error', { sessionId, agent: routing.agent, error: err.message });
    }

    // Step 3: Save to history
    session.history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: `[${agent.name}] ${result}` }
    );

    // Keep history manageable
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }

    this.emit('response', { sessionId, agent: routing.agent, agentName: agent.name, result, routing });
    return { agent: routing.agent, agentName: agent.name, result, routing };
  }

  // Stream version for real-time responses
  async processMessageStream(sessionId, userMessage) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { history: [], acpxSession: `agentOS-${sessionId}` });
    }
    const session = this.sessions.get(sessionId);

    const routing = await routeMessage(userMessage);
    this.emit('routing', { sessionId, routing });

    if (routing.agent === 'claude') {
      // Return ACPX stream
      const stream = executeAcpxStream(session.acpxSession, routing.rewritten_prompt || userMessage);
      return { agent: 'claude', stream, routing };
    }

    // For non-streaming agents, wrap in promise
    const result = await this.processMessage(sessionId, userMessage);
    return { ...result, stream: null };
  }

  getAgents() {
    const reg = getAgentRegistry();
    return Object.entries(reg).map(([id, agent]) => ({ id, ...agent }));
  }

  getSessions() {
    return Array.from(this.sessions.entries()).map(([id, s]) => ({
      id,
      turns: s.history.length / 2,
      acpxSession: s.acpxSession,
    }));
  }
}

// ============ HTTP API ============

export function createOrchestratorAPI(app) {
  const orchestrator = new Orchestrator();

  // Chat endpoint
  app.post('/api/orchestrator/chat', async (req, res) => {
    try {
      const { sessionId = 'default', message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });

      const result = await orchestrator.processMessage(sessionId, message);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Streaming chat endpoint (SSE)
  app.post('/api/orchestrator/chat/stream', async (req, res) => {
    try {
      const { sessionId = 'default', message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send routing info
      const routing = await routeMessage(message);
      res.write(`data: ${JSON.stringify({ type: 'routing', routing })}\n\n`);

      if (routing.agent === 'claude') {
        const stream = executeAcpxStream(
          `agentOS-${sessionId}`,
          routing.rewritten_prompt || message
        );

        stream.on('message', (msg) => {
          res.write(`data: ${JSON.stringify({ type: 'acpx', message: msg })}\n\n`);
        });

        stream.on('text', (text) => {
          res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        });

        stream.on('done', ({ code }) => {
          res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
          res.end();
        });

        stream.on('error', (err) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
          res.end();
        });
      } else {
        const result = await orchestrator.processMessage(sessionId, message);
        res.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  });

  // Route only (classify without executing)
  app.post('/api/orchestrator/route', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });
      const routing = await routeMessage(message);
      res.json(routing);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List agents
  app.get('/api/orchestrator/agents', (_req, res) => {
    res.json(orchestrator.getAgents());
  });

  // List sessions
  app.get('/api/orchestrator/sessions', (_req, res) => {
    res.json(orchestrator.getSessions());
  });

  // Health check
  app.get('/api/orchestrator/health', async (_req, res) => {
    const health = { gestor: false, localLLM: false, acpx: false };

    // Check HF API
    try {
      await askGestor([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
      health.gestor = true;
    } catch {}

    // Check local LLM
    try {
      const r = await fetch(`${LOCAL_LLM_URL}/health`);
      health.localLLM = r.ok;
    } catch {}

    // Check ACPX
    try {
      const { execSync } = await import('child_process');
      execSync('which acpx', { timeout: 3000 });
      health.acpx = true;
    } catch {}

    res.json(health);
  });

  return orchestrator;
}

export { Orchestrator, askGestor, routeMessage, AGENT_REGISTRY };
