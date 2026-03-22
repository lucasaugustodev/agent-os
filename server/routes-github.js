import { execFile } from 'child_process';

export function createGitHubRoutes(app) {
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
  
  console.log('[ROUTES] GitHub loaded');
}
