/**
 * SmolChat Handler - Main chat endpoint.
 * Uses agent-executor for all agent calls (no duplication).
 */

import { spawn } from "child_process";
import crypto from "crypto";
import { executeAgent, executeCliAgentStream, routeMessage, askLlm, getAgent, getGestorConfig } from './agent-executor.js';
import { searchMemoryFiles, organizeMessage } from './memory-organizer.js';

export function createSmolChatHandler(app, db) {

  app.post('/api/smol/chat', async (req, res) => {
    try {
      const { message, stream, threadId: reqThreadId, sessionId } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });

      if (!stream) {
        // Non-streaming: simple orchestrator call
        const routing = await routeMessage(message);
        const result = await executeAgent(routing.agent, routing.rewritten_prompt || message);
        return res.json({ agent: routing.agent, result, routing });
      }

      // SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const send = (event, data) => {
        try { res.write('data: ' + JSON.stringify({ event, ...data }) + '\n\n'); } catch {}
      };

      // Create/get thread
      const threadId = reqThreadId || crypto.randomUUID();
      try {
        const existing = db.prepare('SELECT id FROM threads WHERE id = ?').get(threadId);
        if (!existing) {
          db.prepare('INSERT INTO threads (id, title, status) VALUES (?, ?, ?)').run(threadId, message.substring(0, 80), 'active');
        }
        db.prepare('INSERT INTO thread_events (thread_id, type, content) VALUES (?, ?, ?)').run(threadId, 'user_message', message);
      } catch {}

      // Load thread context
      let threadContext = '';
      try {
        const prev = db.prepare("SELECT type, agent_id, content FROM thread_events WHERE thread_id = ? AND type IN ('user_message','agent_response','agent_summary') ORDER BY created_at DESC LIMIT 10").all(threadId);
        if (prev.length > 1) {
          threadContext = '\n\nContexto da thread:\n' + prev.reverse().map(e => e.type === 'user_message' ? 'User: ' + (e.content || '').substring(0, 200) : (e.agent_id || 'Agent') + ': ' + (e.content || '').substring(0, 300)).join('\n');
        }
        // Thread knowledge
        const tk = db.prepare("SELECT title, content FROM knowledge WHERE thread_id = ? ORDER BY created_at DESC LIMIT 5").all(threadId);
        if (tk.length > 0) threadContext += '\n\nConhecimento da thread:\n' + tk.map(k => '- ' + k.title + ': ' + (k.content || '').substring(0, 200)).join('\n');
      } catch {}

      // Memory search
      let memoryContext = '';
      try {
        const mems = searchMemoryFiles(message, 3);
        if (mems.length > 0) memoryContext = '\n\nConhecimento do sistema:\n' + mems.map(m => '- ' + m.title + ': ' + m.content.substring(0, 300)).join('\n');
      } catch {}

      const fullContext = threadContext + memoryContext;

      // Route
      send('status', { text: 'Analisando...', threadId });
      const routing = await routeMessage(message, fullContext);
      try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content, metadata) VALUES (?, ?, ?, ?, ?)').run(threadId, 'routing', 'gestor', routing.agent, JSON.stringify(routing)); } catch {}

      const agentDef = getAgent(routing.agent);
      const agentName = agentDef?.name || routing.agent;
      const agentType = agentDef?.agent_type || 'smol';

      // Execute based on type
      if (agentType === 'cli' || agentType === 'acpx' || routing.agent === 'coder') {
        // CLI Agent (Claude Code via ACPX)

        // Llama intro
        try {
          const intro = await askLlm(message, {
            systemPrompt: 'Voce e o gestor do Agent OS. O usuario pediu uma tarefa de codigo. Responda em 1-2 frases curtas em portugues dizendo que vai encaminhar pro agente e o que ele vai fazer. Nao use emoji.' + fullContext,
            maxTokens: 100, temperature: 0.7,
          });
          send('status', { text: intro || 'Encaminhando...' });
          try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'agent_intro', 'gestor', intro); } catch {}
        } catch { send('status', { text: 'Encaminhando para ' + agentName + '...' }); }

        send('status', { text: 'Iniciando ' + agentName + '...' });

        // Heartbeat
        let lastStatus = 'Iniciando...';
        let statusIdx = 0;
        const statuses = [agentName + ' inicializando...', agentName + ' conectando...', agentName + ' analisando...', agentName + ' pensando...', agentName + ' escrevendo codigo...', agentName + ' criando arquivos...', agentName + ' ainda trabalhando...', 'Quase pronto...'];
        const heartbeat = setInterval(() => {
          if (statusIdx < statuses.length) lastStatus = statuses[statusIdx];
          statusIdx++;
          send('status', { text: lastStatus });
        }, 3000);

        // Execute
        const promptWithContext = (routing.rewritten_prompt || message) + (fullContext ? '\nContexto:\n' + fullContext.substring(0, 1500) : '');
        let fullResult = '';

        const safePrompt = promptWithContext.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/\$/g, '\\$');
        const shellCmd = `stdbuf -oL sudo -u claude bash -c 'cd /home/claude && stdbuf -oL acpx claude exec "${safePrompt}"' 2>&1`;
        const proc = spawn('bash', ['-c', shellCmd], { timeout: 180000, env: { ...process.env, PYTHONUNBUFFERED: '1' } });

        proc.stdout.on('data', (data) => {
          const text = data.toString();
          fullResult += text;
          for (const line of text.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            if (t.includes('initialize') || t.includes('session/new')) lastStatus = 'Conectando ao ' + agentName + '...';
            else if (t.startsWith('[thinking]')) lastStatus = agentName + ' pensando...';
            else if (t.includes('tool_use') || t.includes('[tool]')) lastStatus = agentName + ' usando ferramentas...';
            else if (!t.startsWith('[') && !t.startsWith('\u26a0')) lastStatus = agentName + ' respondendo...';
            send('status', { text: lastStatus });
          }
        });

        proc.on('close', async (code) => {
          clearInterval(heartbeat);
          const resultLines = fullResult.split('\n').filter(l => {
            const t = l.trim();
            return t && !t.startsWith('[acpx]') && !t.startsWith('[client]') && !t.startsWith('[error]') && !t.startsWith('[done]') && !t.startsWith('[thinking]') && !t.startsWith('\u26a0');
          });
          const cleanResult = resultLines.join('\n').trim() || agentName + ' processou a tarefa.';

          // Log tool calls to thread
          const toolLines = fullResult.split('\n').filter(l => l.trim().startsWith('[tool]'));
          for (const tl of toolLines) {
            try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'tool_call', routing.agent, tl.trim()); } catch {}
          }

          // Llama summary
          let finalMsg = cleanResult;
          try {
            send('status', { text: 'Preparando resumo...' });
            const summary = await askLlm('Pedido: ' + message + '\n\nResultado:\n' + cleanResult.substring(0, 2000), {
              systemPrompt: 'Voce e o gestor do Agent OS. Resuma o que foi feito em 2-3 frases curtas em portugues. Se criou arquivos, mencione. Inclua detalhes tecnicos apos uma linha em branco.',
              maxTokens: 400, temperature: 0.5,
            });
            if (summary) finalMsg = summary;
          } catch {}

          // Save to thread
          try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'agent_response', routing.agent, cleanResult.substring(0, 2000)); } catch {}
          try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'agent_summary', 'gestor', finalMsg.substring(0, 2000)); } catch {}
          try { db.prepare('UPDATE threads SET event_count = (SELECT COUNT(*) FROM thread_events WHERE thread_id = ?), file_count = (SELECT COUNT(*) FROM thread_files WHERE thread_id = ?), primary_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId, threadId, routing.agent, threadId); } catch {}

          // Auto-save + organize
          try {
            const conv = db.prepare('INSERT INTO conversations (agent_id, session_id, title) VALUES (?, ?, ?)').run(routing.agent, threadId, message.substring(0, 80));
            db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id, model_id) VALUES (?, ?, ?, ?, ?)').run(conv.lastInsertRowid, 'user', message, null, null);
            db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id, model_id) VALUES (?, ?, ?, ?, ?)').run(conv.lastInsertRowid, 'assistant', finalMsg, routing.agent, agentDef?.model_id);
            organizeMessage(db, { content: message + '\n' + finalMsg, threadId }, conv.lastInsertRowid, routing.agent).catch(() => {});
          } catch {}

          send('done', { result: finalMsg, threadId });
          res.write('data: [DONE]\n\n');
          res.end();
        });

        proc.on('error', (err) => {
          clearInterval(heartbeat);
          send('done', { result: 'Erro: ' + err.message, threadId });
          res.write('data: [DONE]\n\n');
          res.end();
        });

      } else if (agentType === 'local' || routing.agent === 'sql') {
        // Local Agent (llama-server)
        send('status', { text: agentName + '...' });
        const result = await executeAgent(routing.agent, routing.rewritten_prompt || message, { threadContext: fullContext });

        // Save
        try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'agent_response', routing.agent, result); } catch {}
        try { db.prepare('UPDATE threads SET event_count = (SELECT COUNT(*) FROM thread_events WHERE thread_id = ?), primary_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId, routing.agent, threadId); } catch {}
        try {
          const conv = db.prepare('INSERT INTO conversations (agent_id, session_id, title) VALUES (?, ?, ?)').run(routing.agent, threadId, message.substring(0, 80));
          db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id) VALUES (?, ?, ?, ?)').run(conv.lastInsertRowid, 'user', message, null);
          db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id) VALUES (?, ?, ?, ?)').run(conv.lastInsertRowid, 'assistant', result, routing.agent);
          organizeMessage(db, { content: message + '\n' + result, threadId }, conv.lastInsertRowid, routing.agent).catch(() => {});
        } catch {}

        send('done', { result, threadId });
        res.write('data: [DONE]\n\n');
        res.end();

      } else {
        // SmolAI Agent (Gestor / HF API) - streaming
        send('status', { text: agentName + ' pensando...' });

        const config = getGestorConfig();
        const agent = getAgent(routing.agent);
        const systemPrompt = (agent?.system_prompt || 'Voce e o assistente do Agent OS. Responda em portugues.') + fullContext;

        const hfResp = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + config.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: routing.rewritten_prompt || message }],
            max_tokens: 1024, temperature: 0.7, stream: true,
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
            try { const p = JSON.parse(data); const d = p.choices?.[0]?.delta?.content; if (d) fullResult += d; } catch {}
          }
        }

        // Save
        try { db.prepare('INSERT INTO thread_events (thread_id, type, agent_id, content) VALUES (?, ?, ?, ?)').run(threadId, 'agent_response', routing.agent, fullResult.substring(0, 2000)); } catch {}
        try { db.prepare('UPDATE threads SET event_count = (SELECT COUNT(*) FROM thread_events WHERE thread_id = ?), primary_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId, routing.agent, threadId); } catch {}
        try {
          const conv = db.prepare('INSERT INTO conversations (agent_id, session_id, title) VALUES (?, ?, ?)').run(routing.agent, threadId, message.substring(0, 80));
          db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id, model_id) VALUES (?, ?, ?, ?, ?)').run(conv.lastInsertRowid, 'user', message, null, null);
          db.prepare('INSERT INTO messages (conversation_id, role, content, agent_id, model_id) VALUES (?, ?, ?, ?, ?)').run(conv.lastInsertRowid, 'assistant', fullResult, routing.agent, agent?.model_id);
          organizeMessage(db, { content: message + '\n' + fullResult, threadId }, conv.lastInsertRowid, routing.agent).catch(() => {});
        } catch {}

        send('done', { result: fullResult || 'Sem resposta.', threadId });
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Orchestrator unavailable', detail: err.message });
      } else {
        try {
          res.write('data: ' + JSON.stringify({ event: 'done', result: 'Erro: ' + err.message }) + '\n\n');
          res.write('data: [DONE]\n\n');
          res.end();
        } catch {}
      }
    }
  });

  console.log('[SMOL-CHAT] Handler loaded');
}
