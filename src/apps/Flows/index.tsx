import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Brain, Send, Loader2, Clock, CheckCircle, AlertCircle, Play, Circle } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Flow {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  progress?: number;
  steps?: FlowStep[];
  created_at?: string;
  schedule?: string;
  template?: string;
}

interface FlowStep {
  id?: string;
  name?: string;
  status?: string;
  output?: string;
}

interface FlowTemplate {
  id: string;
  name: string;
  description?: string;
}

type ColStatus = 'backlog' | 'running' | 'scheduled' | 'done' | 'failed';

const COLS: { id: ColStatus; label: string; icon: React.ReactNode }[] = [
  { id: 'backlog', label: 'Backlog', icon: <Circle size={12} /> },
  { id: 'running', label: 'Running', icon: <Play size={12} /> },
  { id: 'scheduled', label: 'Scheduled', icon: <Clock size={12} /> },
  { id: 'done', label: 'Done', icon: <CheckCircle size={12} /> },
  { id: 'failed', label: 'Failed', icon: <AlertCircle size={12} /> },
];

const COL_ACCENT: Record<ColStatus, string> = {
  backlog: '#6b7280',
  running: '#00e5cc',
  scheduled: '#f59e0b',
  done: '#22c55e',
  failed: '#ef4444',
};

const BG = '#0a0e17';
const PANEL = '#0d1420';
const SURFACE = '#111928';
const BORDER = '#1a2332';
const ACCENT = '#00e5cc';
const TEXT = '#e0e0e0';
const MUTED = '#4a6080';

export default function FlowsApp(_props: AppComponentProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [selected, setSelected] = useState<Flow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', template: '', input: '', schedule: '' });
  const [creating, setCreating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/flows');
      if (res.ok) setFlows(await res.json());
    } catch {}
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/flow-templates');
      if (res.ok) setTemplates(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchFlows(); fetchTemplates(); }, [fetchFlows, fetchTemplates]);

  const createFlow = async () => {
    if (!createForm.name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        await fetchFlows();
        setShowCreate(false);
        setCreateForm({ name: '', template: '', input: '', schedule: '' });
      }
    } catch {}
    setCreating(false);
  };

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
        body: JSON.stringify({ message: msg, stream: false }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.content ?? data.message ?? '...' }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao conectar.' }]);
    }
    setChatBusy(false);
  };

  const colFlows = (status: ColStatus) =>
    flows.filter((f) => (f.status ?? 'backlog').toLowerCase() === status);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: BG, color: TEXT }}>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
          <span className="text-sm font-semibold">Flows</span>
          <div className="flex gap-2">
            <button onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
              style={{
                background: chatOpen ? ACCENT + '20' : SURFACE,
                color: chatOpen ? ACCENT : MUTED,
                border: '1px solid ' + (chatOpen ? ACCENT + '44' : BORDER),
              }}>
              <Brain size={13} /> Brain
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: ACCENT, color: BG }}>
              <Plus size={13} /> Novo Flow
            </button>
          </div>
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-full gap-0 min-w-max">
            {COLS.map((col) => {
              const colItems = colFlows(col.id);
              return (
                <div key={col.id} className="w-56 flex flex-col h-full"
                  style={{ borderRight: '1px solid ' + BORDER }}>
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 shrink-0"
                    style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
                    <span style={{ color: COL_ACCENT[col.id] }}>{col.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: COL_ACCENT[col.id] }}>{col.label}</span>
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                      style={{ background: COL_ACCENT[col.id] + '20', color: COL_ACCENT[col.id] }}>
                      {colItems.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colItems.map((flow) => (
                      <button key={flow.id}
                        onClick={() => setSelected(selected?.id === flow.id ? null : flow)}
                        className="w-full text-left rounded-lg p-2.5 transition-colors"
                        style={{
                          background: selected?.id === flow.id ? ACCENT + '10' : SURFACE,
                          border: '1px solid ' + (selected?.id === flow.id ? ACCENT + '44' : BORDER),
                        }}>
                        <p className="text-xs font-medium truncate mb-2">{flow.name ?? flow.title ?? flow.id.slice(0, 8)}</p>
                        {flow.progress != null && (
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs" style={{ color: MUTED }}>Progress</span>
                              <span className="text-xs" style={{ color: COL_ACCENT[col.id] }}>{flow.progress}%</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: BORDER }}>
                              <div className="h-full rounded-full transition-all"
                                style={{ width: flow.progress + '%', background: COL_ACCENT[col.id] }} />
                            </div>
                          </div>
                        )}
                        {flow.schedule && (
                          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: MUTED }}>
                            <Clock size={10} /> {flow.schedule}
                          </p>
                        )}
                      </button>
                    ))}
                    {colItems.length === 0 && (
                      <div className="flex items-center justify-center py-6">
                        <span className="text-xs" style={{ color: MUTED }}>Vazio</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 flex flex-col" style={{ borderLeft: '1px solid ' + BORDER, background: PANEL }}>
          <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid ' + BORDER }}>
            <span className="text-xs font-semibold truncate">{selected.name ?? selected.title}</span>
            <button onClick={() => setSelected(null)} className="p-0.5 rounded hover:bg-white/5" style={{ color: MUTED }}>
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Detalhes</p>
              {[
                ['ID', selected.id.slice(0, 12)],
                ['Status', selected.status ?? 'backlog'],
                ['Template', selected.template ?? '-'],
                ['Schedule', selected.schedule ?? '-'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ color: TEXT }}>{v}</span>
                </div>
              ))}
            </div>
            {selected.steps && selected.steps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Steps</p>
                {selected.steps.map((step, i) => (
                  <div key={step.id ?? i} className="rounded-lg p-2"
                    style={{ background: SURFACE, border: '1px solid ' + BORDER }}>
                    <div className="flex items-center gap-2 text-xs">
                      {step.status === 'done' ? <CheckCircle size={11} style={{ color: '#22c55e' }} /> :
                       step.status === 'running' ? <Play size={11} style={{ color: ACCENT }} /> :
                       step.status === 'failed' ? <AlertCircle size={11} style={{ color: '#ef4444' }} /> :
                       <Circle size={11} style={{ color: MUTED }} />}
                      <span className="flex-1 truncate">{step.name ?? 'Step ' + (i + 1)}</span>
                    </div>
                    {step.output && (
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: MUTED, whiteSpace: 'pre-wrap' }}>
                        {step.output.slice(0, 200)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brain chat sidebar */}
      {chatOpen && (
        <div className="w-64 shrink-0 flex flex-col" style={{ borderLeft: '1px solid ' + BORDER, background: PANEL }}>
          <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid ' + BORDER }}>
            <div className="flex items-center gap-2">
              <Brain size={14} style={{ color: ACCENT }} />
              <span className="text-xs font-semibold">Brain</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-0.5 rounded hover:bg-white/5" style={{ color: MUTED }}>
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
              <div className="flex items-center gap-1.5 px-3 py-2">
                <Loader2 size={11} className="animate-spin" style={{ color: ACCENT }} />
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

      {/* Create modal */}
      {showCreate && (
        <div className="absolute inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-96 rounded-xl overflow-hidden"
            style={{ background: PANEL, border: '1px solid ' + BORDER }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid ' + BORDER }}>
              <span className="text-sm font-semibold">Novo Flow</span>
              <button onClick={() => setShowCreate(false)} style={{ color: MUTED }}>
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>Nome</label>
                <input value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do flow"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>Template</label>
                <select value={createForm.template}
                  onChange={(e) => setCreateForm((p) => ({ ...p, template: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT }}>
                  <option value="">Sem template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>Input</label>
                <textarea value={createForm.input}
                  onChange={(e) => setCreateForm((p) => ({ ...p, input: e.target.value }))}
                  placeholder="Parâmetros de entrada..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>Schedule (opcional)</label>
                <input value={createForm.schedule}
                  onChange={(e) => setCreateForm((p) => ({ ...p, schedule: e.target.value }))}
                  placeholder="ex: 0 9 * * 1-5"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid ' + BORDER }}>
              <button onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: SURFACE, color: MUTED, border: '1px solid ' + BORDER }}>
                Cancelar
              </button>
              <button onClick={createFlow} disabled={creating || !createForm.name.trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
                style={{ background: ACCENT, color: BG, opacity: creating ? 0.6 : 1 }}>
                {creating && <Loader2 size={12} className="animate-spin" />}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
