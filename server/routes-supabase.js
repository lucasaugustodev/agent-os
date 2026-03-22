import { execFile } from 'child_process';
import path from 'path';
import os from 'os';

export function createSupabaseRoutes(app) {
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
  
  console.log('[ROUTES] Supabase loaded');
}
