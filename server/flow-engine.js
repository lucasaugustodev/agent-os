/**
 * Agent OS Flow Engine
 * Executes flows: sequences of agent steps with monitoring and validation.
 */

import crypto from 'crypto';

// ============ SETUP TABLES ============

export function setupFlowTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      steps TEXT NOT NULL,
      created_by TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'backlog',
      current_step INTEGER DEFAULT 0,
      total_steps INTEGER,
      input TEXT,
      output TEXT,
      thread_id TEXT,
      monitor_log TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flow_id TEXT REFERENCES flows(id),
      step_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      agent_id TEXT,
      prompt_template TEXT,
      status TEXT DEFAULT 'pending',
      thread_id TEXT,
      input TEXT,
      output TEXT,
      duration_ms INTEGER,
      error TEXT,
      started_at DATETIME,
      completed_at DATETIME
    );
  `);

  try { db.exec('ALTER TABLE flows ADD COLUMN schedule TEXT'); } catch {}
  try { db.exec('ALTER TABLE flows ADD COLUMN schedule_cron TEXT'); } catch {}
  try { db.exec('ALTER TABLE flows ADD COLUMN next_run DATETIME'); } catch {}
  try { db.exec('ALTER TABLE flows ADD COLUMN last_run DATETIME'); } catch {}
  try { db.exec('ALTER TABLE flows ADD COLUMN run_count INTEGER DEFAULT 0'); } catch {}

  // Seed default templates
  const insert = db.prepare('INSERT OR IGNORE INTO flow_templates (id, name, description, steps, tags) VALUES (?, ?, ?, ?, ?)');

  insert.run('landing-page', 'Landing Page', 'Cria uma landing page completa', JSON.stringify([
    { name: 'Criar HTML/CSS/JS', agent_id: 'coder', prompt: 'Cria uma landing page completa para: {{input}}. Inclua HTML, CSS e JS em um unico arquivo.', on_fail: 'retry' },
    { name: 'Revisar resultado', agent_id: 'gestor', prompt: 'Revise o que foi criado e faca um resumo do resultado: {{previous_result}}', on_fail: 'skip' },
  ]), '["web","frontend","landing"]');

  insert.run('feature', 'Nova Feature', 'Planeja e implementa uma feature', JSON.stringify([
    { name: 'Planejar', agent_id: 'gestor', prompt: 'Planeje a implementacao desta feature: {{input}}. Liste os passos necessarios.', on_fail: 'retry' },
    { name: 'Implementar', agent_id: 'coder', prompt: 'Implemente baseado no plano: {{previous_result}}', on_fail: 'retry' },
    { name: 'Revisar', agent_id: 'gestor', prompt: 'Revise a implementacao: {{previous_result}}', on_fail: 'skip' },
  ]), '["code","feature"]');

  insert.run('bug-fix', 'Bug Fix', 'Diagnostica e corrige um bug', JSON.stringify([
    { name: 'Diagnosticar', agent_id: 'gestor', prompt: 'Analise este bug e sugira a causa: {{input}}', on_fail: 'retry' },
    { name: 'Corrigir', agent_id: 'coder', prompt: 'Corrija o bug baseado no diagnostico: {{previous_result}}', on_fail: 'retry' },
    { name: 'Verificar', agent_id: 'gestor', prompt: 'Verifique se a correcao esta adequada: {{previous_result}}', on_fail: 'escalate' },
  ]), '["code","debug","fix"]');

  insert.run('sql-task', 'SQL Task', 'Analisa e executa operacoes de banco', JSON.stringify([
    { name: 'Analisar schema', agent_id: 'sql', prompt: 'Analise o schema necessario para: {{input}}', on_fail: 'retry' },
    { name: 'Gerar query', agent_id: 'sql', prompt: 'Gere a query baseado na analise: {{previous_result}}', on_fail: 'retry' },
    { name: 'Revisar', agent_id: 'gestor', prompt: 'Revise a query gerada: {{previous_result}}', on_fail: 'skip' },
  ]), '["sql","database"]');

  insert.run('research', 'Pesquisa', 'Pesquisa e documenta um topico', JSON.stringify([
    { name: 'Pesquisar', agent_id: 'gestor', prompt: 'Pesquise sobre: {{input}}. Seja detalhado.', on_fail: 'retry' },
    { name: 'Documentar', agent_id: 'gestor', prompt: 'Organize a pesquisa em um documento estruturado: {{previous_result}}', on_fail: 'skip' },
  ]), '["research","docs"]');
}

// ============ FLOW EXECUTION ============

export async function executeFlow(db, flowId, chatFn) {
  const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId);
  if (!flow) throw new Error('Flow not found');

  const steps = db.prepare('SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY step_index').all(flowId);

  // Update status to running
  db.prepare('UPDATE flows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('running', flowId);

  // Log to thread
  if (flow.thread_id) {
    db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
      flow.thread_id, 'status', 'flow-agent', `Flow "${flow.name}" iniciado com ${steps.length} etapas`, JSON.stringify({ flow_id: flowId })
    );
  }

  let previousResult = flow.input || '';

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Update current step
    db.prepare('UPDATE flows SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(i + 1, flowId);
    db.prepare('UPDATE flow_steps SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?').run('running', step.id);

    // Build prompt
    let prompt = (step.prompt_template || '{{input}}')
      .replace(/\{\{input\}\}/g, flow.input || '')
      .replace(/\{\{previous_result\}\}/g, previousResult);

    // Log step start in thread
    if (flow.thread_id) {
      db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
        flow.thread_id, 'status', 'flow-agent',
        `Etapa ${i + 1}/${steps.length}: ${step.name} [${step.agent_id}]`,
        JSON.stringify({ step_index: i, agent: step.agent_id })
      );
    }

    // Execute step via chat function
    const startTime = Date.now();
    try {
      const result = await chatFn(prompt, step.agent_id, flow.thread_id);
      const duration = Date.now() - startTime;

      // Save result
      db.prepare('UPDATE flow_steps SET status = ?, output = ?, duration_ms = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('completed', result.substring(0, 5000), duration, step.id);

      previousResult = result;

      // Log success in thread
      if (flow.thread_id) {
        db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
          flow.thread_id, 'agent_response', step.agent_id,
          result.substring(0, 2000),
          JSON.stringify({ step: step.name, duration_ms: duration })
        );
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      db.prepare('UPDATE flow_steps SET status = ?, error = ?, duration_ms = ? WHERE id = ?')
        .run('failed', err.message, duration, step.id);

      // Log failure
      if (flow.thread_id) {
        db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
          flow.thread_id, 'error', 'flow-agent',
          `Etapa "${step.name}" falhou: ${err.message}`,
          JSON.stringify({ step: step.name, on_fail: step.on_fail || 'skip' })
        );
      }

      // Handle failure
      const onFail = JSON.parse(step.prompt_template || '{}').on_fail || 'skip';
      if (onFail === 'skip') continue;
      if (onFail === 'escalate') {
        db.prepare('UPDATE flows SET status = ?, output = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', `Falhou na etapa: ${step.name}`, flowId);
        return;
      }
      // retry: just continue (simple for now)
    }
  }

  // Flow completed
  db.prepare('UPDATE flows SET status = ?, output = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('completed', previousResult.substring(0, 5000), flowId);

  // Final log
  if (flow.thread_id) {
    db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(
      flow.thread_id, 'status', 'flow-agent',
      `Flow "${flow.name}" concluido com sucesso!`,
      JSON.stringify({ flow_id: flowId, status: 'completed' })
    );
    db.prepare('UPDATE threads SET event_count = (SELECT COUNT(*) FROM thread_events WHERE thread_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(flow.thread_id, flow.thread_id);
  }
}

// ============ API ROUTES ============

export function createFlowAPI(app, db) {
  setupFlowTables(db);

  // Templates
  app.get('/api/flow-templates', (_req, res) => {
    res.json(db.prepare('SELECT * FROM flow_templates ORDER BY name').all());
  });

  app.post('/api/flow-templates', (req, res) => {
    const { id, name, description, steps, tags } = req.body;
    const tid = id || name.toLowerCase().replace(/\s+/g, '-');
    db.prepare('INSERT INTO flow_templates (id, name, description, steps, tags) VALUES (?, ?, ?, ?, ?)')
      .run(tid, name, description, JSON.stringify(steps), JSON.stringify(tags || []));
    res.status(201).json({ id: tid });
  });

  // Flows
  app.get('/api/flows', (req, res) => {
    const status = req.query.status;
    if (status) {
      res.json(db.prepare('SELECT * FROM flows WHERE status = ? ORDER BY updated_at DESC').all(status));
    } else {
      res.json(db.prepare('SELECT * FROM flows ORDER BY updated_at DESC LIMIT 50').all());
    }
  });

  app.get('/api/flows/:id', (req, res) => {
    const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    const steps = db.prepare('SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY step_index').all(req.params.id);
    res.json({ ...flow, steps });
  });

  app.post('/api/flows', (req, res) => {
    const { template_id, name, input } = req.body;
    const flowId = crypto.randomUUID();

    let steps;
    let flowName = name;

    if (template_id) {
      const template = db.prepare('SELECT * FROM flow_templates WHERE id = ?').get(template_id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      steps = JSON.parse(template.steps);
      flowName = flowName || template.name + ': ' + (input || '').substring(0, 40);
    } else {
      steps = req.body.steps || [];
      flowName = flowName || 'Custom Flow';
    }

    // Create thread for flow
    const threadId = crypto.randomUUID();
    db.prepare('INSERT INTO threads (id, title, status, primary_agent_id) VALUES (?, ?, ?, ?)').run(threadId, flowName, 'active', 'flow-agent');
    db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'status', 'flow-agent', `Flow criado: ${flowName}`);

    // Create flow
    db.prepare('INSERT INTO flows (id, template_id, name, status, total_steps, input, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(flowId, template_id, flowName, 'backlog', steps.length, input, threadId);

    // Create steps
    const insertStep = db.prepare('INSERT INTO flow_steps (flow_id, step_index, name, agent_id, prompt_template) VALUES (?, ?, ?, ?, ?)');
    steps.forEach((s, i) => {
      insertStep.run(flowId, i, s.name, s.agent_id, s.prompt || s.prompt_template || '{{input}}');
    });

    res.status(201).json({ id: flowId, thread_id: threadId });
  });

  app.post('/api/flows/:id/start', async (req, res) => {
    const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json({ ok: true, message: 'Flow started' });

    // Execute in background
    const chatFn = async (prompt, agentId, threadId) => {
      // Use smol/chat which handles ACPX exec mode properly
      const resp = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/smol/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, stream: true, threadId }),
      });
      // Parse SSE stream to extract result
      const text = await resp.text();
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          if (ev.event === 'done' && ev.result) return ev.result;
        } catch {}
      }
      return 'Step completed';
    };

    executeFlow(db, req.params.id, chatFn).catch(err => {
      console.error('[FLOW] Error:', err.message);
      db.prepare('UPDATE flows SET status = ?, output = ? WHERE id = ?').run('failed', err.message, req.params.id);
    });
  });

  app.post('/api/flows/:id/pause', (req, res) => {
    db.prepare('UPDATE flows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('paused', req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/flows/:id/cancel', (req, res) => {
    db.prepare('UPDATE flows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('cancelled', req.params.id);
    res.json({ ok: true });
  });


  // Schedule check - runs every 60s
  setInterval(() => {
    try {
      const due = db.prepare("SELECT * FROM flows WHERE schedule IS NOT NULL AND status = 'scheduled' AND next_run <= datetime('now')").all();
      for (const flow of due) {
        console.log('[FLOW] Running scheduled flow:', flow.name);
        db.prepare("UPDATE flows SET status = 'backlog', run_count = run_count + 1, last_run = datetime('now') WHERE id = ?").run(flow.id);
        // Auto-start
        const chatFn = async (prompt, agentId, threadId) => {
          const resp = await fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/smol/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, stream: true, threadId }),
          });
          const text = await resp.text();
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try { const ev = JSON.parse(data); if (ev.event === 'done' && ev.result) return ev.result; } catch {}
          }
          return 'Step completed';
        };
        executeFlow(db, flow.id, chatFn).then(() => {
          // Calculate next run
          if (flow.schedule_cron) {
            // Simple: parse interval in minutes
            const mins = parseInt(flow.schedule_cron) || 60;
            db.prepare("UPDATE flows SET status = 'scheduled', next_run = datetime('now', '+' || ? || ' minutes') WHERE id = ?").run(mins, flow.id);
          }
        }).catch(() => {});
      }
    } catch {}
  }, 60000);

  // Schedule API
  app.post('/api/flows/:id/schedule', (req, res) => {
    const { schedule, interval_minutes } = req.body;
    db.prepare("UPDATE flows SET schedule = ?, schedule_cron = ?, status = 'scheduled', next_run = datetime('now', '+' || ? || ' minutes') WHERE id = ?")
      .run(schedule, String(interval_minutes || 60), interval_minutes || 60, req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/flows/:id/schedule', (req, res) => {
    db.prepare("UPDATE flows SET schedule = NULL, schedule_cron = NULL, next_run = NULL, status = 'backlog' WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  console.log('Flow engine loaded');
}
