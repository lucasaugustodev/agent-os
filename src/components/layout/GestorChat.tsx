import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mic, Bot } from 'lucide-react';

const API_BASE = '/api/launcher';
const WS_URL = `ws://${window.location.host}/ws`;

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  ts: number;
}

export function GestorChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('gestor_messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'thinking' | 'online'>('idle');
  const [unread, setUnread] = useState(false);

  const sessionRef = useRef<string | null>(localStorage.getItem('gestor_session_id'));
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef('');
  const openRef = useRef(open);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const isStreamJsonRef = useRef(false);

  useEffect(() => { openRef.current = open; }, [open]);

  // Save messages
  useEffect(() => {
    localStorage.setItem('gestor_messages', JSON.stringify(messages.slice(-50)));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  function connectWs(sessionId: string): Promise<boolean> {
    // Reuse existing promise if connecting
    if (connectPromiseRef.current && wsRef.current && wsRef.current.readyState === 0) {
      return connectPromiseRef.current;
    }
    // Already connected to same session
    if (wsRef.current && wsRef.current.readyState === 1) {
      return Promise.resolve(true);
    }

    if (wsRef.current) wsRef.current.close();
    setStatus('connecting');

    const promise = new Promise<boolean>((resolve) => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        resolve(false);
        setStatus('idle');
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setStatus('online');
        ws.send(JSON.stringify({ type: 'attach', sessionId }));
        resolve(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          handleWsMessage(msg);
        } catch {}
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        setStatus('idle');
        connectPromiseRef.current = null;
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
        setStatus('idle');
        connectPromiseRef.current = null;
      };
    });

    connectPromiseRef.current = promise;
    return promise;
  }

  function flushBuffer() {
    if (bufferRef.current.trim()) {
      const text = bufferRef.current.trim();
      bufferRef.current = '';
      setMessages(prev => {
        // Avoid duplicating the same message
        if (prev.length > 0 && prev[prev.length - 1].text === text && prev[prev.length - 1].role === 'assistant') return prev;
        return [...prev, { role: 'assistant', text, ts: Date.now() }];
      });
      if (!openRef.current) setUnread(true);
    }
  }

  function handleStreamEvent(event: any) {
    if (!event) return;

    // Assistant message with content — buffer the text
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'text' && block.text) {
          bufferRef.current += block.text;
        }
      }
      // If stop_reason is set, this is a complete message — flush immediately
      if (event.message.stop_reason === 'end_turn' || event.message.stop_reason === 'tool_use') {
        flushBuffer();
        if (event.message.stop_reason === 'end_turn') setStatus('online');
      }
    }

    if (event.type === 'content_block_delta' && event.delta?.text) {
      bufferRef.current += event.delta.text;
    }

    // Result = final event, flush anything remaining
    if (event.type === 'result') {
      if (!bufferRef.current.trim() && event.result) {
        bufferRef.current = event.result;
      }
      flushBuffer();
      setStatus('online');
    }
  }

  function handleWsMessage(msg: { type: string; data?: any; event?: any }) {
    // Stream JSON events (type: "stream-json", payload in msg.event)
    if (msg.type === 'stream-json' && msg.event) {
      isStreamJsonRef.current = true;
      handleStreamEvent(msg.event);
    }

    // Alternative format (type: "terminal:stream-json", payload in msg.data)
    if (msg.type === 'terminal:stream-json' && msg.data) {
      isStreamJsonRef.current = true;
      handleStreamEvent(msg.data);
    }

    // Raw terminal output — only process if NOT a stream-json session
    if (msg.type === 'output' && msg.data && !isStreamJsonRef.current) {
      const lines = msg.data.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          handleStreamEvent(parsed);
        } catch {
          // ignore non-JSON output
        }
      }
    }

    if (msg.type === 'exit') {
      if (bufferRef.current.trim()) {
        setMessages(prev => [...prev, { role: 'assistant', text: bufferRef.current.trim(), ts: Date.now() }]);
        bufferRef.current = '';
      }
      setStatus('idle');
      sessionRef.current = null;
      localStorage.removeItem('gestor_session_id');
    }
  }

  async function ensureSession(): Promise<string | null> {
    // Check existing session
    if (sessionRef.current) {
      try {
        const res = await fetch(`${API_BASE}/sessions`);
        const sessions = await res.json();
        if (sessions.some((s: { id: string }) => s.id === sessionRef.current)) {
          const connected = await connectWs(sessionRef.current!);
          return connected ? sessionRef.current : null;
        }
      } catch {}
      // Session gone, clear it
      sessionRef.current = null;
      localStorage.removeItem('gestor_session_id');
    }

    // Launch new session
    setStatus('connecting');
    try {
      const res = await fetch(`${API_BASE}/claude-agents/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'manager-gestor',
          workingDirectory: '/home/claude',
          mode: 'bypass',
          nodeMemory: null,
          streamJson: true,
          prompt: 'oi',
        }),
      });
      const session = await res.json();
      if (session.id) {
        sessionRef.current = session.id;
        localStorage.setItem('gestor_session_id', session.id);
        const connected = await connectWs(session.id);
        return connected ? session.id : null;
      }
    } catch {}
    setStatus('idle');
    return null;
  }

  async function handleOpen() {
    setOpen(true);
    setUnread(false);
    await ensureSession();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setStatus('thinking');

    const sid = await ensureSession();
    if (!sid || !wsRef.current || wsRef.current.readyState !== 1) {
      setMessages(prev => [...prev, { role: 'system', text: 'Falha ao conectar. Tente novamente.', ts: Date.now() }]);
      setStatus('idle');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'stream-json-input',
      sessionId: sid,
      message: text,
    }));
  }

  const statusColor = status === 'online' ? 'var(--os-accent)'
    : status === 'thinking' ? 'var(--os-yellow)'
    : status === 'connecting' ? 'var(--os-yellow)'
    : 'var(--os-text-muted)';

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-7 left-6 z-[1002] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #00e5cc, #0088aa)',
          boxShadow: '0 4px 20px rgba(0, 229, 204, 0.3)',
        }}
        onClick={() => open ? setOpen(false) : handleOpen()}
      >
        <Bot size={24} color="#0a0e17" />
        {unread && !open && (
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full animate-pulse"
            style={{ background: 'var(--os-red)', border: '2px solid #0a0e17' }} />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-24 left-6 z-[1002] flex flex-col rounded-2xl overflow-hidden"
            style={{
              width: 380,
              height: 500,
              background: 'rgba(10, 14, 23, 0.92)',
              backdropFilter: 'blur(48px) saturate(150%)',
              border: '1px solid rgba(0, 229, 204, 0.15)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 229, 204, 0.2)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00e5cc, #0088aa)' }}>
                <Bot size={18} color="#0a0e17" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>Manager Gestor</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                  <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                    {status === 'online' ? 'Online' : status === 'thinking' ? 'Pensando...' : status === 'connecting' ? 'Conectando...' : 'Offline'}
                  </span>
                </div>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => setOpen(false)}>
                <X size={16} style={{ color: 'var(--os-text-muted)' }} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot size={32} className="mx-auto mb-3" style={{ color: 'var(--os-accent)', opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
                    Inicie uma conversa com o Manager Gestor
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: msg.role === 'user'
                        ? 'rgba(0, 229, 204, 0.15)'
                        : msg.role === 'system'
                        ? 'rgba(255, 184, 77, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: msg.role === 'system' ? 'var(--os-yellow)' : 'var(--os-text)',
                      borderBottomRightRadius: msg.role === 'user' ? '4px' : undefined,
                      borderBottomLeftRadius: msg.role !== 'user' ? '4px' : undefined,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {status === 'thinking' && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--os-accent)', animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--os-accent)', animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--os-accent)', animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button className="p-2 rounded-lg hover:bg-white/5 shrink-0 cursor-pointer"
                style={{ color: 'var(--os-text-muted)' }}>
                <Mic size={16} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--os-text-muted)]"
                style={{ color: 'var(--os-text)' }}
              />
              <button
                className="p-2 rounded-lg shrink-0 cursor-pointer transition-colors"
                style={{
                  background: input.trim() ? 'var(--os-accent)' : 'transparent',
                  color: input.trim() ? '#0a0e17' : 'var(--os-text-muted)',
                }}
                onClick={handleSend}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
