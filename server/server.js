import { createOrchestratorAPI } from "./orchestrator.js";
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import {
  createBrowserSession,
  getSession as getBrowserSession,
  getAllSessions as getBrowserSessions,
  handleBrowserWsMessage,
  closeBrowserSession,
} from './browser-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const LAUNCHER_URL = process.env.LAUNCHER_URL || 'http://localhost:3002';
const LAUNCHER_WS = process.env.LAUNCHER_WS || 'ws://localhost:3002/ws';

const app = express();
app.use(express.json());

// --- Serve built frontend ---
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

// --- Agent OS API ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Browser API ---
app.get('/api/browsers', (_req, res) => res.json(getBrowserSessions()));
app.post('/api/browsers', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const session = await createBrowserSession(id, req.body.url || 'https://www.google.com');
    res.status(201).json({ id: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/browsers/:id', async (req, res) => {
  await closeBrowserSession(req.params.id);
  res.json({ ok: true });
});

// Browser AI control endpoints
app.post('/api/browsers/:id/navigate', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    await session.page.goto(req.body.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    res.json({ ok: true, url: session.page.url() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/browsers/:id/click', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    if (req.body.selector) {
      await session.page.click(req.body.selector, { timeout: 5000 });
    } else {
      await session.page.mouse.click(req.body.x | 0, req.body.y | 0);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/browsers/:id/type', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    if (req.body.selector) {
      await session.page.fill(req.body.selector, req.body.text || '', { timeout: 5000 });
    } else {
      await session.page.keyboard.type(req.body.text || '');
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/browsers/:id/press', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    await session.page.keyboard.press(req.body.key);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/browsers/:id/text', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    const title = await session.page.title().catch(() => '');
    const url = session.page.url();
    let text = '';
    try {
      // Try innerText first
      text = await session.page.evaluate(() => {
        try { return document.body.innerText || ''; } catch { return ''; }
      });
    } catch {}
    if (!text) {
      try {
        // Fallback: get all text content via textContent
        text = await session.page.evaluate(() => {
          try { return document.body.textContent || ''; } catch { return ''; }
        });
      } catch {}
    }
    if (!text) {
      try {
        // Last resort: get raw HTML and strip tags
        const html = await session.page.content();
        text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch {}
    }
    // Also get all links and form elements for AI navigation
    let elements = '';
    try {
      elements = await session.page.evaluate(() => {
        const items = [];
        document.querySelectorAll('a[href]').forEach((a, i) => {
          if (i < 20) items.push(`link: "${a.textContent?.trim().substring(0, 50)}" [${a.getAttribute('href')?.substring(0, 80)}]`);
        });
        document.querySelectorAll('input, textarea, select, button').forEach((el, i) => {
          if (i < 15) {
            const tag = el.tagName.toLowerCase();
            const type = el.getAttribute('type') || '';
            const name = el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('placeholder') || '';
            const text = el.textContent?.trim().substring(0, 30) || '';
            const selector = el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `${tag}${type ? `[type="${type}"]` : ''}`;
            items.push(`${tag}(${type}): "${name || text}" selector="${selector}"`);
          }
        });
        return items.join('\n');
      });
    } catch {}
    res.json({ title, url, text: (text || '').substring(0, 5000), elements });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/browsers/:id/screenshot', async (req, res) => {
  const session = getBrowserSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Browser not found' });
  try {
    const buf = await session.page.screenshot({ type: 'jpeg', quality: 50 });
    res.type('image/jpeg').send(buf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- File download proxy (binary pipe) ---
app.get('/api/launcher/files/download', async (req, res) => {
  try {
    const targetUrl = `${LAUNCHER_URL}/api/files/download${req.url.slice(req.url.indexOf('?'))}`;
    const resp = await fetch(targetUrl);
    if (!resp.ok) return res.status(resp.status).json({ error: 'Download failed' });
    // Forward headers
    for (const [k, v] of resp.headers.entries()) {
      if (['content-type', 'content-disposition', 'content-length'].includes(k)) {
        res.setHeader(k, v);
      }
    }
    // Pipe body
    const reader = resp.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    };
    await pump();
  } catch (err) {
    res.status(502).json({ error: 'Download proxy failed', detail: err.message });
  }
});

// --- File upload proxy (multipart pipe) ---
app.post('/api/launcher/files/upload', async (req, res) => {
  try {
    const targetUrl = `${LAUNCHER_URL}/api/files/upload`;
    // Pipe the raw request to launcher
    const headers = { ...req.headers, host: undefined };
    delete headers.host;
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: req,
      duplex: 'half',
    });
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch (err) {
    res.status(502).json({ error: 'Upload proxy failed', detail: err.message });
  }
});

// --- PM2 API ---
import { execFile } from 'child_process';
function pm2Exec(args) {
  return new Promise((resolve, reject) => {
    // Run pm2 as claude user
    execFile('sudo', ['-u', 'claude', 'pm2', ...args], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(err);
      resolve(stdout);
    });
  });
}

app.get('/api/pm2/list', async (_req, res) => {
  try {
    const raw = await pm2Exec(['jlist']);
    const procs = JSON.parse(raw);
    const list = procs.map(p => ({
      id: p.pm_id,
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      pid: p.pid,
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
      user: p.pm2_env?.username || '',
    }));
    // Also get root PM2 processes
    try {
      const rootRaw = await new Promise((resolve, reject) => {
        execFile('pm2', ['jlist'], { timeout: 10000 }, (err, stdout) => {
          if (err && !stdout) return reject(err);
          resolve(stdout);
        });
      });
      const rootProcs = JSON.parse(rootRaw);
      for (const p of rootProcs) {
        list.push({
          id: p.pm_id,
          name: p.name,
          status: p.pm2_env?.status || 'unknown',
          pid: p.pid,
          cpu: p.monit?.cpu || 0,
          memory: p.monit?.memory || 0,
          uptime: p.pm2_env?.pm_uptime || 0,
          restarts: p.pm2_env?.restart_time || 0,
          user: 'root',
        });
      }
    } catch {}
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pm2/action', async (req, res) => {
  const { action, name, user } = req.body;
  if (!action || !name) return res.status(400).json({ error: 'action and name required' });
  if (!['restart', 'stop', 'start', 'delete'].includes(action)) return res.status(400).json({ error: 'invalid action' });
  try {
    if (user === 'root') {
      await new Promise((resolve, reject) => {
        execFile('pm2', [action, name], { timeout: 10000 }, (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
    } else {
      await pm2Exec([action, name]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pm2/logs/:name', async (req, res) => {
  const { name } = req.params;
  const user = req.query.user || 'claude';
  try {
    let logs;
    if (user === 'root') {
      logs = await new Promise((resolve, reject) => {
        execFile('pm2', ['logs', name, '--lines', '50', '--nostream'], { timeout: 10000 }, (err, stdout, stderr) => {
          resolve((stdout || '') + (stderr || ''));
        });
      });
    } else {
      logs = await new Promise((resolve, reject) => {
        execFile('sudo', ['-u', 'claude', 'pm2', 'logs', name, '--lines', '50', '--nostream'], { timeout: 10000 }, (err, stdout, stderr) => {
          resolve((stdout || '') + (stderr || ''));
        });
      });
    }
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Supabase CLI API ---
let sbToken = '';

function sbExec(args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, SUPABASE_ACCESS_TOKEN: sbToken, HOME: '/home/claude' };
    execFile('supabase', args, { timeout: 15000, cwd: '/home/claude', env }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(stderr || err.message));
      resolve(stdout || stderr || '');
    });
  });
}

app.get('/api/supabase/auth', async (_req, res) => {
  if (!sbToken) return res.json({ loggedIn: false });
  try {
    const out = await sbExec(['projects', 'list']);
    res.json({ loggedIn: true, hasProjects: out.includes('│') });
  } catch {
    res.json({ loggedIn: false });
  }
});

app.post('/api/supabase/login', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  sbToken = token;
  try {
    const out = await sbExec(['projects', 'list']);
    if (out.includes('│') || out.includes('LINKED') || !out.includes('error')) {
      // Inject token into agent daemon
      fetch('http://127.0.0.1:8082/env?key=SUPABASE_ACCESS_TOKEN&value=' + encodeURIComponent(token)).catch(() => {});
      // Persist token in claude's .bashrc
      try {
        const { writeFileSync, readFileSync } = await import('fs');
        const bashrc = '/home/claude/.bashrc';
        let content = readFileSync(bashrc, 'utf8');
        content = content.replace(/export SUPABASE_ACCESS_TOKEN=.*/g, '');
        content += `\nexport SUPABASE_ACCESS_TOKEN="${token}"\n`;
        writeFileSync(bashrc, content);
      } catch {}
      res.json({ ok: true });
    } else {
      sbToken = '';
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    sbToken = '';
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/supabase/token', (_req, res) => {
  res.json({ token: sbToken || null });
});

// Set supabase token in smol daemon env
app.post('/api/supabase/sync-token', async (_req, res) => {
  if (!sbToken) return res.json({ ok: false });
  try {
    // Restart daemon with SUPABASE_ACCESS_TOKEN
    await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'bash', '-c',
        `HF_TOKEN=${process.env.HF_TOKEN || ''} SUPABASE_ACCESS_TOKEN=${sbToken} pm2 restart smol-daemon --update-env`
      ], { timeout: 10000 }, (err) => err ? reject(err) : resolve(null));
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/supabase/logout', (_req, res) => {
  sbToken = '';
  res.json({ ok: true });
});

app.get('/api/supabase/projects', async (_req, res) => {
  if (!sbToken) return res.status(401).json({ error: 'Not logged in' });
  try {
    // Use Management API directly for JSON output
    const r = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${sbToken}` },
    });
    res.status(r.status).type('application/json').send(await r.text());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/supabase/project/:id', async (req, res) => {
  if (!sbToken) return res.status(401).json({ error: 'Not logged in' });
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${req.params.id}`, {
      headers: { Authorization: `Bearer ${sbToken}` },
    });
    res.status(r.status).type('application/json').send(await r.text());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/supabase/tables/:id', async (req, res) => {
  if (!sbToken) return res.status(401).json({ error: 'Not logged in' });
  try {
    // Query pg_tables via REST
    const r = await fetch(`https://api.supabase.com/v1/projects/${req.params.id}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sbToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size, (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columns FROM information_schema.tables t WHERE table_schema = 'public' ORDER BY table_name" }),
    });
    res.status(r.status).type('application/json').send(await r.text());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/supabase/sql/:id', async (req, res) => {
  if (!sbToken) return res.status(401).json({ error: 'Not logged in' });
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${req.params.id}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sbToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: req.body.query }),
    });
    res.status(r.status).type('application/json').send(await r.text());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GitHub CLI API ---
app.get('/api/github/auth', async (_req, res) => {
  try {
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'auth', 'status'], { timeout: 5000 }, (err, stdout, stderr) => {
        resolve((stdout || '') + (stderr || ''));
      });
    });
    const loggedIn = out.includes('Logged in');
    const match = out.match(/account (\S+)/);
    res.json({ loggedIn, account: match?.[1] || null, raw: out });
  } catch {
    res.json({ loggedIn: false, account: null });
  }
});

app.post('/api/github/login', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    await new Promise((resolve, reject) => {
      const child = execFile('sudo', ['-u', 'claude', 'gh', 'auth', 'login', '--with-token'], { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
      child.stdin.write(token);
      child.stdin.end();
    });
    // Verify
    const status = await new Promise((resolve) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'auth', 'status'], { timeout: 5000 }, (err, stdout, stderr) => {
        resolve((stdout || '') + (stderr || ''));
      });
    });
    const match = status.match(/account (\S+)/);
    res.json({ ok: true, account: match?.[1] || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/github/logout', async (_req, res) => {
  try {
    await new Promise((resolve) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'auth', 'logout', '--hostname', 'github.com', '-y'], { timeout: 5000 }, () => resolve(null));
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

app.get('/api/github/repos', async (_req, res) => {
  try {
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'repo', 'list', '--json', 'name,description,visibility,updatedAt,url,primaryLanguage', '--limit', '30'], { timeout: 15000 }, (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      });
    });
    res.json(JSON.parse(out));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/github/repo/:owner/:name', async (req, res) => {
  try {
    const repo = `${req.params.owner}/${req.params.name}`;
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'repo', 'view', repo, '--json', 'name,description,url,stargazerCount,forkCount,primaryLanguage,defaultBranchRef,issues,pullRequests,updatedAt'], { timeout: 15000 }, (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      });
    });
    res.json(JSON.parse(out));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/github/issues/:owner/:name', async (req, res) => {
  try {
    const repo = `${req.params.owner}/${req.params.name}`;
    const state = req.query.state || 'open';
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'issue', 'list', '-R', repo, '--state', state, '--json', 'number,title,state,author,createdAt,labels,url', '--limit', '20'], { timeout: 15000 }, (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      });
    });
    res.json(JSON.parse(out));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/github/prs/:owner/:name', async (req, res) => {
  try {
    const repo = `${req.params.owner}/${req.params.name}`;
    const state = req.query.state || 'open';
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'pr', 'list', '-R', repo, '--state', state, '--json', 'number,title,state,author,createdAt,url,headRefName', '--limit', '20'], { timeout: 15000 }, (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      });
    });
    res.json(JSON.parse(out));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/github/notifications', async (_req, res) => {
  try {
    const out = await new Promise((resolve, reject) => {
      execFile('sudo', ['-u', 'claude', 'gh', 'api', 'notifications', '--jq', '.[0:15] | map({id:.id, reason:.reason, title:.subject.title, type:.subject.type, repo:.repository.full_name, updated:.updated_at})'], { timeout: 15000 }, (err, stdout) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      });
    });
    res.json(JSON.parse(out || '[]'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SmolAgent daemon proxy ---
app.post('/api/smol/chat', async (req, res) => {
  // Route through orchestrator with real-time streaming
  try {
    const { message, stream } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const sessionId = req.body.sessionId || 'smolchat-default';

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Step 1: Route via orchestrator
      res.write('data: ' + JSON.stringify({ event: 'status', text: 'Analisando...' }) + '\n\n');

      const routeResp = await fetch('http://127.0.0.1:' + PORT + '/api/orchestrator/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const routing = await routeResp.json();

      // Step 2: Execute based on agent type
      if (routing.agent === 'claude') {
        // Llama responds FIRST telling user what's happening
        const HF_TOKEN_PRE = process.env.HF_TOKEN;
        try {
          const preResp = await fetch('https://router.huggingface.co/groq/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + HF_TOKEN_PRE, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: 'Voce e o gestor do Agent OS. O usuario pediu uma tarefa de codigo. Responda em 1-2 frases curtas em portugues dizendo que vai encaminhar pro Claude Code e o que ele vai fazer. Seja direto e amigavel. Nao use emoji.' },
                { role: 'user', content: message },
              ],
              max_tokens: 100,
              temperature: 0.7,
            }),
          });
          const preData = await preResp.json();
          const preMsg = preData.choices?.[0]?.message?.content || 'Encaminhando para o Claude Code...';
          // Send Llama's intro as a partial message
          res.write('data: ' + JSON.stringify({ event: 'status', text: preMsg }) + '\n\n');
        } catch {
          res.write('data: ' + JSON.stringify({ event: 'status', text: 'Encaminhando para o Claude Code...' }) + '\n\n');
        }

        // Stream Claude Code via ACPX exec (no persistent session needed)
        const { spawn } = await import('child_process');

        res.write('data: ' + JSON.stringify({ event: 'status', text: 'Iniciando Claude Code...' }) + '\n\n');

        const safePrompt = (routing.rewritten_prompt || message).replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\$/g, '\\$');
        // Use 'acpx exec' which creates temp session automatically - no session management needed
        const shellCmd = `stdbuf -oL sudo -u claude bash -c 'cd /home/claude && stdbuf -oL acpx claude exec "${safePrompt}"' 2>&1`;
        const proc = spawn('bash', ['-c', shellCmd], { timeout: 180000, env: { ...process.env, PYTHONUNBUFFERED: '1' } });

        let fullResult = '';
        let lastStatus = 'Iniciando Claude Code...';
        let statusCount = 0;
        const statusMessages = [
          'Claude inicializando...',
          'Claude conectando...',
          'Claude analisando...',
          'Claude pensando...',
          'Claude escrevendo codigo...',
          'Claude criando arquivos...',
          'Claude ainda trabalhando...',
          'Quase pronto...',
        ];

        // Heartbeat: send status every 3s
        const heartbeat = setInterval(() => {
          if (statusCount < statusMessages.length) {
            lastStatus = statusMessages[statusCount];
          }
          statusCount++;
          try {
            res.write('data: ' + JSON.stringify({ event: 'status', text: lastStatus }) + '\n\n');
          } catch {}
        }, 3000);

        proc.stdout.on('data', (data) => {
          const text = data.toString();
          fullResult += text;
          const lines = text.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            if (t.includes('initialize') || t.includes('session/new')) {
              lastStatus = 'Conectando ao Claude...';
            } else if (t.startsWith('[thinking]')) {
              lastStatus = 'Claude pensando...';
            } else if (t.includes('tool_use') || t.includes('[tool]')) {
              lastStatus = 'Claude usando ferramentas...';
            } else if (!t.startsWith('[') && !t.startsWith('⚠')) {
              lastStatus = 'Claude respondendo...';
            }
            try {
              res.write('data: ' + JSON.stringify({ event: 'status', text: lastStatus }) + '\n\n');
            } catch {}
          }
        });

        proc.on('close', (code) => {
          clearInterval(heartbeat);
          const resultLines = fullResult.split('\n').filter(l => {
            const t = l.trim();
            return t && !t.startsWith('[acpx]') && !t.startsWith('[client]') && !t.startsWith('[error]') && !t.startsWith('[done]') && !t.startsWith('[thinking]') && !t.startsWith('⚠');
          });
          const cleanResult = resultLines.join('\n').trim() || 'Claude processou a tarefa.';
          try {
            res.write('data: ' + JSON.stringify({ event: 'done', result: cleanResult }) + '\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
          } catch {}
        });

        proc.on('error', (err) => {
          clearInterval(heartbeat);
          try {
            res.write('data: ' + JSON.stringify({ event: 'done', result: 'Erro: ' + err.message }) + '\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
          } catch {}
        });

      } else if (routing.agent === 'sql') {
        // SQL Agent - fast, no streaming needed
        res.write('data: ' + JSON.stringify({ event: 'status', text: 'Consultando modelo SQL...' }) + '\n\n');
        const sqlResp = await fetch('http://127.0.0.1:8080/v1/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: '<|im_start|>system\nYou are a command adapter. Output ONLY valid JSON. No explanation.<|im_end|>\n<|im_start|>user\n' + (routing.rewritten_prompt || message) + '<|im_end|>\n<|im_start|>assistant\n',
            max_tokens: 200, temperature: 0.1, stop: ['<|im_end|>'],
          }),
        });
        const sqlData = await sqlResp.json();
        const sqlResult = sqlData.choices[0].text.trim();
        res.write('data: ' + JSON.stringify({ event: 'done', result: sqlResult }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();

      } else {
        // Gestor - stream directly from HF API with real-time token output
        res.write('data: ' + JSON.stringify({ event: 'status', text: 'Gestor pensando...' }) + '\n\n');

        const HF_TOKEN = process.env.HF_TOKEN;
        const systemPrompt = `Voce e o assistente do Agent OS, um sistema operacional de agentes IA da Hub Formaturas. Responda em portugues de forma clara e amigavel.\n\nO Agent OS tem: Browser, Terminal, SmolChat (chat IA), Agents (gestao), Supabase, GitHub, PM2 Manager, File Explorer.\nAgentes: Claude Code (programacao), SQL Agent (queries banco), Gestor (voce, duvidas gerais).`;

        const hfResp = await fetch('https://router.huggingface.co/groq/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + HF_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: routing.rewritten_prompt || message },
            ],
            max_tokens: 1024,
            temperature: 0.7,
            stream: true,
          }),
        });

        let fullResult = '';
        const reader = hfResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullResult += delta;
              }
            } catch {}
          }
        }

        res.write('data: ' + JSON.stringify({ event: 'done', result: fullResult || 'Sem resposta.' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      const chatResp = await fetch('http://127.0.0.1:' + PORT + '/api/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await chatResp.text();
      res.status(chatResp.status).type('application/json').send(data);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Orchestrator unavailable', detail: err.message });
    } else {
      res.write('data: ' + JSON.stringify({ event: 'done', result: 'Erro: ' + err.message }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

app.get('/api/smol/health', async (_req, res) => {
  try {
    const resp = await fetch('http://127.0.0.1:8082/');
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch {
    res.status(502).json({ status: 'offline' });
  }
});

// --- Proxy ALL /api/launcher/* to claude-launcher-web on :3002 ---
app.use('/api/launcher', async (req, res) => {
  try {
    const targetPath = req.url; // includes query string
    const targetUrl = `${LAUNCHER_URL}/api${targetPath}`;
    const opts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      opts.body = JSON.stringify(req.body);
    }
    const resp = await fetch(targetUrl, opts);
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch (err) {
    res.status(502).json({ error: 'Launcher unavailable', detail: err.message });
  }
});
// --- Orchestrator API ---
const orchestrator = createOrchestratorAPI(app);
console.log("Orchestrator loaded");


// --- SPA fallback ---
app.get('*', (_req, res) => {
  if (existsSync(join(distDir, 'index.html'))) {
    res.sendFile(join(distDir, 'index.html'));
  } else {
    res.status(404).json({ error: 'Frontend not built.' });
  }
});

// --- File watcher registry ---
import { watch } from 'fs';
const fileWatchers = new Map(); // path -> { watcher, clients: Set<ws> }

function watchDir(dirPath, ws) {
  // Add client to existing watcher
  if (fileWatchers.has(dirPath)) {
    fileWatchers.get(dirPath).clients.add(ws);
    return;
  }
  // Create new watcher
  try {
    const clients = new Set([ws]);
    const watcher = watch(dirPath, { persistent: false }, (eventType, filename) => {
      const msg = JSON.stringify({ type: 'fs:change', path: dirPath, event: eventType, file: filename });
      for (const c of clients) {
        if (c.readyState === 1) c.send(msg);
      }
    });
    watcher.on('error', () => { unwatchDir(dirPath); });
    fileWatchers.set(dirPath, { watcher, clients });
  } catch { /* dir might not exist */ }
}

function unwatchDir(dirPath, ws) {
  const entry = fileWatchers.get(dirPath);
  if (!entry) return;
  if (ws) {
    entry.clients.delete(ws);
    if (entry.clients.size === 0) {
      entry.watcher.close();
      fileWatchers.delete(dirPath);
    }
  } else {
    entry.watcher.close();
    fileWatchers.delete(dirPath);
  }
}

function unwatchAllForClient(ws) {
  for (const [dirPath, entry] of fileWatchers) {
    entry.clients.delete(ws);
    if (entry.clients.size === 0) {
      entry.watcher.close();
      fileWatchers.delete(dirPath);
    }
  }
}

// --- WebSocket ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  // Each client might have a launcher WS connection for terminal
  let launcherWs = null;

  ws.on('message', (raw) => {
    // Binary frames are not expected from client
    if (typeof raw !== 'string' && !(raw instanceof Buffer)) return;
    const str = raw.toString();

    try {
      const msg = JSON.parse(str);

      // File watch messages
      if (msg.type === 'fs:watch') {
        // Unwatch previous dir for this client
        unwatchAllForClient(ws);
        if (msg.path) watchDir(msg.path, ws);
        return;
      }
      if (msg.type === 'fs:unwatch') {
        if (msg.path) unwatchDir(msg.path, ws);
        else unwatchAllForClient(ws);
        return;
      }

      // Browser messages
      if (msg.type?.startsWith('browser:')) {
        handleBrowserWsMessage(ws, msg);
        return;
      }

      // Terminal messages → proxy to launcher WebSocket
      if (['attach', 'detach', 'input', 'resize', 'stream-json-input'].includes(msg.type)) {
        if (!launcherWs || launcherWs.readyState !== WebSocket.OPEN) {
          // Create connection to launcher WS
          launcherWs = new WebSocket(LAUNCHER_WS);
          launcherWs.on('open', () => {
            // Forward the original message
            launcherWs.send(str);
          });
          launcherWs.on('message', (data) => {
            // Forward launcher responses back to client as UTF-8 string
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data.toString('utf8'));
            }
          });
          launcherWs.on('close', () => {
            launcherWs = null;
          });
          launcherWs.on('error', () => {
            launcherWs = null;
          });
        } else {
          launcherWs.send(str);
        }
        return;
      }

      // Ping
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch { /* ignore */ }
  });

  ws.on('close', () => {
    unwatchAllForClient(ws);
    if (launcherWs && launcherWs.readyState === WebSocket.OPEN) {
      launcherWs.close();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent OS on http://0.0.0.0:${PORT} (launcher proxy → ${LAUNCHER_URL})`);
});
