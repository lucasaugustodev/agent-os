import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, RefreshCw, ChevronRight, Bot } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Thread {
  id: string;
  title: string;
  agent?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
}

interface ThreadEvent {
  id: string | number;
  type: string;
  content?: string;
  summary?: string;
  tool?: string;
  timestamp?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

const AGENTS = ['Auto', 'Claude Code', 'SQL Agent', 'Gestor'];

const BG = '#0a0e17';
const PANEL = '#0d1420';
const SURFACE = '#111928';
const BORDER = '#1a2332';
const ACCENT = '#00e5cc';
const TEXT = '#e0e0e0';
const MUTED = '#4a6080';

export default function ThreadsApp(_props: AppComponentProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [tab, setTab] = useState<'timeline' | 'chat'>('chat');
  const [input, setInput] = useState('');
  const [agent, setAgent] = useState('Auto');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/threads');
      if (res.ok) setThreads(await res.json());
    } catch {}
  }, []);

  const fetchEvents = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/threads/' + id + '/events');
      if (res.ok) setEvents(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    if (selectedId) fetchEvents(selectedId);
    else setEvents([]);
  }, [selectedId, fetchEvents]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !selectedId) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    setEvents(prev => [...prev, { id: Date.now(), type: 'user_message', content: msg, created_at: new Date().toISOString() }]);
    try {
      const resp = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, stream: false, threadId: selectedId }),
      });
      const data = await resp.json();
      if (data.result) {
        setEvents(prev => [...prev, { id: Date.now()+1, type: 'agent_response', agent_id: agent, content: data.result, created_at: new Date().toISOString() } as ThreadEvent]);
      }
      await fetchEvents(selectedId);
    } catch {}
    setSending(false);
  };

  const chatEvents = events.filter((e) =>
    ['user_message', 'agent_response', 'agent_summary'].includes(e.type)
  );

  const displayEvents = tab === 'chat' ? chatEvents : events;

  const eventColor = (type: string) => {
    if (type === 'user_message') return ACCENT + '20';
    if (type.startsWith('agent')) return '#7c3aed20';
    if (type === 'tool_call' || type === 'tool_result') return '#f59e0b20';
    if (type === 'error') return '#ef444420';
    return SURFACE;
  };
  const eventBorder = (type: string) => {
    if (type === 'user_message') return ACCENT + '44';
    if (type.startsWith('agent')) return '#7c3aed44';
    if (type === 'tool_call' || type === 'tool_result') return '#f59e0b44';
    if (type === 'error') return '#ef444444';
    return BORDER;
  };

  const formatTime = (s?: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: BG, color: TEXT }}>
      {/* Left panel - thread list */}
      <div className="w-60 shrink-0 flex flex-col" style={{ borderRight: '1px solid ' + BORDER, background: PANEL }}>
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid ' + BORDER }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Threads</span>
          <button onClick={fetchThreads}
            className="p-1 rounded hover:bg-white/5"
            style={{ color: MUTED }}>
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <div className="flex items-center justify-center h-20">
              <span className="text-xs" style={{ color: MUTED }}>Nenhum thread</span>
            </div>
          )}
          {threads.map((t) => (
            <button key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/5 transition-colors"
              style={{
                background: selectedId === t.id ? ACCENT + '10' : 'transparent',
                borderLeft: '2px solid ' + (selectedId === t.id ? ACCENT : 'transparent'),
              }}>
              <MessageSquare size={13} className="mt-0.5 shrink-0" style={{ color: selectedId === t.id ? ACCENT : MUTED }} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: selectedId === t.id ? TEXT : TEXT + 'cc' }}>
                  {t.title || t.id.slice(0, 8)}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: MUTED }}>
                  {t.agent ?? ''} {t.message_count ? '· ' + t.message_count + ' msgs' : ''}
                </p>
              </div>
              <ChevronRight size={12} className="ml-auto shrink-0 mt-0.5" style={{ color: MUTED, opacity: selectedId === t.id ? 1 : 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare size={32} style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>Selecione um thread</p>
          </div>
        ) : (
          <>
            {/* Tabs + agent selector */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0"
              style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
              <div className="flex gap-1">
                {(['chat', 'timeline'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: tab === t ? ACCENT + '20' : 'transparent',
                      color: tab === t ? ACCENT : MUTED,
                      border: '1px solid ' + (tab === t ? ACCENT + '44' : 'transparent'),
                    }}>
                    {t === 'chat' ? 'Chat' : 'Timeline'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {AGENTS.map((a) => (
                  <button key={a} onClick={() => setAgent(a)}
                    className="px-2 py-1 rounded text-xs transition-colors"
                    style={{
                      background: agent === a ? ACCENT + '20' : 'transparent',
                      color: agent === a ? ACCENT : MUTED,
                      border: '1px solid ' + (agent === a ? ACCENT + '44' : 'transparent'),
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Events */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 justify-center py-4">
                  <RefreshCw size={14} className="animate-spin" style={{ color: MUTED }} />
                  <span className="text-xs" style={{ color: MUTED }}>Carregando...</span>
                </div>
              )}
              {!loading && displayEvents.length === 0 && (
                <div className="flex items-center justify-center h-20">
                  <span className="text-xs" style={{ color: MUTED }}>Sem eventos</span>
                </div>
              )}
              {displayEvents.map((ev) => (
                <div key={ev.id} className="flex gap-3">
                  {tab === 'timeline' && (
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: ev.type === 'user_message' ? ACCENT : ev.type.startsWith('agent') ? '#7c3aed' : MUTED }} />
                      <div className="w-px flex-1 mt-1" style={{ background: BORDER }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: eventColor(ev.type), border: '1px solid ' + eventBorder(ev.type), color: TEXT }}>
                        {ev.type}
                      </span>
                      {ev.tool && <span className="text-xs" style={{ color: MUTED }}>{ev.tool}</span>}
                      <span className="text-xs ml-auto" style={{ color: MUTED }}>
                        {formatTime(ev.timestamp ?? ev.created_at)}
                      </span>
                    </div>
                    {(ev.content ?? ev.summary) && (
                      <div className="px-3 py-2 rounded-lg text-sm leading-relaxed"
                        style={{
                          background: eventColor(ev.type),
                          border: '1px solid ' + eventBorder(ev.type),
                          whiteSpace: 'pre-wrap',
                          userSelect: 'text',
                        }}>
                        {ev.content ?? ev.summary}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
            </div>

            {/* Chat input */}
            <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid ' + BORDER, background: PANEL }}>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: SURFACE, border: '1px solid ' + BORDER }}>
                <Bot size={14} style={{ color: MUTED }} />
                <input value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                  placeholder="Continuar conversa..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: TEXT, userSelect: 'text' }}
                />
                <button onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{
                    background: input.trim() && !sending ? ACCENT : SURFACE,
                    opacity: input.trim() && !sending ? 1 : 0.4,
                  }}>
                  <Send size={11} style={{ color: input.trim() && !sending ? BG : MUTED }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
