import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { watch } from 'fs';
import crypto from 'crypto';

// Route modules
import { createBrowserRoutes } from './routes-browser.js';
import { createPM2Routes } from './routes-pm2.js';
import { createSupabaseRoutes } from './routes-supabase.js';
import { createGitHubRoutes } from './routes-github.js';

// Core modules
import { createOrchestratorAPI } from './orchestrator.js';
import { createDatabaseAPI } from './database.js';
import db from './database.js';
import { createMemoryAPI } from './memory-organizer.js';
import { createFlowAPI } from './flow-engine.js';
import { initExecutor } from './agent-executor.js';
import { createOnboardingAPI } from "./onboarding.js";
import { createSmolChatHandler } from './smol-chat-handler.js';

// Browser manager (for WebSocket)
import { handleBrowserWsMessage } from './browser-manager.js';

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

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Route modules ---
createBrowserRoutes(app);
createPM2Routes(app);
createSupabaseRoutes(app);
createGitHubRoutes(app);

// --- Core modules ---
const orchestrator = createOrchestratorAPI(app);
createDatabaseAPI(app);
createMemoryAPI(app, db);
createFlowAPI(app, db);
initExecutor(db);
createSmolChatHandler(app, db);
createOnboardingAPI(app, db);

// --- SmolAgent health ---
app.get('/api/smol/health', async (_req, res) => {
  try {
    const resp = await fetch('http://127.0.0.1:8082/');
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch {
    res.status(502).json({ status: 'offline' });
  }
});

// --- File proxies ---
app.get('/api/launcher/files/download', async (req, res) => {
  try {
    const targetUrl = `${LAUNCHER_URL}/api/files/download${req.url.slice(req.url.indexOf('?'))}`;
    const resp = await fetch(targetUrl);
    if (!resp.ok) return res.status(resp.status).json({ error: 'Download failed' });
    for (const [k, v] of resp.headers.entries()) {
      if (['content-type', 'content-disposition', 'content-length'].includes(k)) res.setHeader(k, v);
    }
    const reader = resp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      res.write(value);
    }
  } catch (err) {
    res.status(502).json({ error: 'Download proxy failed', detail: err.message });
  }
});

app.post('/api/launcher/files/upload', async (req, res) => {
  try {
    const headers = { ...req.headers, host: undefined };
    delete headers.host;
    const resp = await fetch(`${LAUNCHER_URL}/api/files/upload`, { method: 'POST', headers, body: req, duplex: 'half' });
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch (err) {
    res.status(502).json({ error: 'Upload proxy failed', detail: err.message });
  }
});

// --- Launcher proxy ---
app.use('/api/launcher', async (req, res) => {
  try {
    const targetUrl = `${LAUNCHER_URL}/api${req.url}`;
    const opts = { method: req.method, headers: { 'Content-Type': 'application/json' } };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) opts.body = JSON.stringify(req.body);
    const resp = await fetch(targetUrl, opts);
    const data = await resp.text();
    res.status(resp.status).type('application/json').send(data);
  } catch (err) {
    res.status(502).json({ error: 'Launcher unavailable', detail: err.message });
  }
});

// --- SPA fallback ---
app.get('*', (_req, res) => {
  if (existsSync(join(distDir, 'index.html'))) {
    res.sendFile(join(distDir, 'index.html'));
  } else {
    res.status(404).json({ error: 'Frontend not built.' });
  }
});

// --- File watcher ---
const fileWatchers = new Map();
function watchDir(dirPath, ws) {
  if (fileWatchers.has(dirPath)) { fileWatchers.get(dirPath).clients.add(ws); return; }
  try {
    const clients = new Set([ws]);
    const watcher = watch(dirPath, { persistent: false }, (eventType, filename) => {
      const msg = JSON.stringify({ type: 'fs:change', path: dirPath, event: eventType, file: filename });
      for (const c of clients) { if (c.readyState === 1) c.send(msg); }
    });
    watcher.on('error', () => { unwatchDir(dirPath); });
    fileWatchers.set(dirPath, { watcher, clients });
  } catch {}
}
function unwatchDir(dirPath, ws) {
  const entry = fileWatchers.get(dirPath);
  if (!entry) return;
  if (ws) { entry.clients.delete(ws); if (entry.clients.size === 0) { entry.watcher.close(); fileWatchers.delete(dirPath); } }
  else { entry.watcher.close(); fileWatchers.delete(dirPath); }
}
function unwatchAllForClient(ws) {
  for (const [dirPath, entry] of fileWatchers) {
    entry.clients.delete(ws);
    if (entry.clients.size === 0) { entry.watcher.close(); fileWatchers.delete(dirPath); }
  }
}

// --- WebSocket ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let launcherWs = null;
  ws.on('message', (raw) => {
    if (typeof raw !== 'string' && !(raw instanceof Buffer)) return;
    const str = raw.toString();
    try {
      const msg = JSON.parse(str);
      if (msg.type === 'fs:watch') { unwatchAllForClient(ws); if (msg.path) watchDir(msg.path, ws); return; }
      if (msg.type === 'fs:unwatch') { if (msg.path) unwatchDir(msg.path, ws); else unwatchAllForClient(ws); return; }
      if (msg.type?.startsWith('browser:')) { handleBrowserWsMessage(ws, msg); return; }
      if (['attach', 'detach', 'input', 'resize', 'stream-json-input'].includes(msg.type)) {
        if (!launcherWs || launcherWs.readyState !== WebSocket.OPEN) {
          launcherWs = new WebSocket(LAUNCHER_WS);
          launcherWs.on('open', () => { launcherWs.send(str); });
          launcherWs.on('message', (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data.toString('utf8')); });
          launcherWs.on('close', () => { launcherWs = null; });
          launcherWs.on('error', () => { launcherWs = null; });
        } else { launcherWs.send(str); }
        return;
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch {}
  });
  ws.on('close', () => {
    unwatchAllForClient(ws);
    if (launcherWs && launcherWs.readyState === WebSocket.OPEN) launcherWs.close();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent OS on http://0.0.0.0:${PORT} (launcher proxy -> ${LAUNCHER_URL})`);
});
