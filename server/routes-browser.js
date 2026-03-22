import { createBrowserSession, getSession as getBrowserSession, getAllSessions as getBrowserSessions, closeBrowserSession } from './browser-manager.js';

export function createBrowserRoutes(app) {
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
  
  console.log('[ROUTES] Browser loaded');
}
