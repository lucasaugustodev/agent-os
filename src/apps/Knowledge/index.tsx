import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Brain, X, Send, Loader2 } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

type KTab = 'knowledge' | 'vault' | 'files';

interface KItem {
  id?: string;
  name?: string;
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  path?: string;
  size?: number;
}

const BG = '#0a0e17';
const PANEL = '#0d1420';
const SURFACE = '#111928';
const BORDER = '#1a2332';
const ACCENT = '#00e5cc';
const TEXT = '#e0e0e0';
const MUTED = '#4a6080';


function safeParse(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

export default function KnowledgeApp(_props: AppComponentProps) {
  const [tab, setTab] = useState<KTab>('knowledge');
  const [items, setItems] = useState<KItem[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);

  const endpoints: Record<KTab, string> = {
    knowledge: '/api/memory/knowledge',
    vault: '/api/memory/vault',
    files: '/api/memory/files',
  };

  const fetchItems = useCallback(async (t: KTab) => {
    setLoading(true);
    setItems([]);
    try {
      const res = await fetch(endpoints[t]);
      if (res.ok) setItems(await res.json());
    } catch {}
    setLoading(false);
  }, []); // eslint-disable-line

  useEffect(() => { fetchItems(tab); }, [tab, fetchItems]);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return !q ||
      (item.name ?? item.title ?? '').toLowerCase().includes(q) ||
      (item.content ?? item.summary ?? '').toLowerCase().includes(q) ||
      (item.path ?? '').toLowerCase().includes(q);
  });

  const [details, setDetails] = useState<Record<string, string>>({});

  const toggleExpand = async (id: string, item?: KItem) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Fetch detail if not loaded
    if (!details[id] && item) {
      try {
        if (tab === 'knowledge' && item.id) {
          const r = await fetch('/api/memory/knowledge/' + item.id);
          const d = await r.json();
          if (d.content) setDetails(prev => ({...prev, [id]: d.content}));
        } else if (tab === 'files' && item.path) {
          const name = (item.path || item.name || '').split('/').pop() || '';
          const r = await fetch('/api/memory/files/' + encodeURIComponent(name));
          const d = await r.json();
          if (d.content) setDetails(prev => ({...prev, [id]: d.content}));
        }
      } catch {}
    }
  };

  const getKey = (item: KItem, i: number) => item.id ?? item.path ?? String(i);

  const sendChat = async () => {
    if (!chatInput.trim() || chatBusy) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '[Knowledge context] ' + msg, stream: false }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.content ?? data.message ?? '...' }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao conectar.' }]);
    }
    setChatBusy(false);
  };

  const TABS: { id: KTab; label: string }[] = [
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'vault', label: 'Vault' },
    { id: 'files', label: 'Memory Files' },
  ];

  return (
    <div className="flex h-full overflow-hidden" style={{ background: BG, color: TEXT }}>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: tab === t.id ? ACCENT + '20' : 'transparent',
                  color: tab === t.id ? ACCENT : MUTED,
                  border: '1px solid ' + (tab === t.id ? ACCENT + '44' : 'transparent'),
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors"
            style={{
              background: chatOpen ? ACCENT + '20' : SURFACE,
              color: chatOpen ? ACCENT : MUTED,
              border: '1px solid ' + (chatOpen ? ACCENT + '44' : BORDER),
            }}>
            <Brain size={13} /> Brain
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid ' + BORDER }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: SURFACE, border: '1px solid ' + BORDER }}>
            <Search size={13} style={{ color: MUTED }} />
            <input value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: TEXT, userSelect: 'text' }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: MUTED }} />
              <span className="text-xs" style={{ color: MUTED }}>Carregando...</span>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs" style={{ color: MUTED }}>Nenhum item encontrado</span>
            </div>
          )}
          {filtered.map((item, i) => {
            const key = getKey(item, i);
            const label = item.name ?? item.title ?? item.path ?? key;
            const body = details[key] || item.content || item.summary || item.description;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className="rounded-lg overflow-hidden"
                style={{ border: '1px solid ' + BORDER, background: SURFACE }}>
                <button onClick={() => toggleExpand(key, item)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left">
                  {isOpen ? <ChevronDown size={13} style={{ color: MUTED }} /> : <ChevronRight size={13} style={{ color: MUTED }} />}
                  <span className="flex-1 text-sm font-medium truncate">{label}</span>
                  {safeParse(item.tags).length > 0 && (
                    <div className="flex gap-1">
                      {safeParse(item.tags).slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: ACCENT + '15', color: ACCENT }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.size != null && (
                    <span className="text-xs shrink-0" style={{ color: MUTED }}>
                      {(item.size / 1024).toFixed(1)}KB
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 text-sm leading-relaxed"
                    style={{ color: TEXT + 'cc', whiteSpace: 'pre-wrap', borderTop: '1px solid ' + BORDER, userSelect: 'text' }}>
                    {body || 'Carregando...'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Brain chat sidebar */}
      {chatOpen && (
        <div className="w-72 shrink-0 flex flex-col" style={{ borderLeft: '1px solid ' + BORDER, background: PANEL }}>
          <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid ' + BORDER }}>
            <div className="flex items-center gap-2">
              <Brain size={14} style={{ color: ACCENT }} />
              <span className="text-xs font-semibold" style={{ color: TEXT }}>Brain</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-0.5 rounded hover:bg-white/5"
              style={{ color: MUTED }}>
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {chatMessages.map((m, i) => (
              <div key={i}
                className={'px-3 py-2 rounded-lg text-xs leading-relaxed ' + (m.role === 'user' ? 'ml-4' : 'mr-4')}
                style={{
                  background: m.role === 'user' ? ACCENT + '20' : SURFACE,
                  border: '1px solid ' + (m.role === 'user' ? ACCENT + '33' : BORDER),
                  whiteSpace: 'pre-wrap',
                  userSelect: 'text',
                }}>
                {m.content}
              </div>
            ))}
            {chatBusy && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={11} className="animate-spin" style={{ color: ACCENT }} />
                <span className="text-xs" style={{ color: MUTED }}>...</span>
              </div>
            )}
          </div>
          <div className="shrink-0 px-3 py-2.5" style={{ borderTop: '1px solid ' + BORDER }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: SURFACE, border: '1px solid ' + BORDER }}>
              <input value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder="Perguntar..."
                className="flex-1 bg-transparent outline-none text-xs"
                style={{ color: TEXT, userSelect: 'text' }}
              />
              <button onClick={sendChat} disabled={chatBusy}
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ background: ACCENT, opacity: chatBusy ? 0.4 : 1 }}>
                <Send size={10} style={{ color: BG }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
