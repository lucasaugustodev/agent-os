import { execFile } from 'child_process';

export function createPM2Routes(app) {
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
  
  console.log('[ROUTES] PM2 loaded');
}
