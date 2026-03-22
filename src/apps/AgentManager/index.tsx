import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Save, Loader2, Bot } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Agent {
  id: string;
  name: string;
  type?: string;
  model?: string;
  description?: string;
  system_prompt?: string;
  capabilities?: string[];
  acpx_command?: string;
  status?: string;
}

interface Model {
  id: string;
  name: string;
  type?: string;
  provider?: string;
}

const AGENT_TYPES = ['SmolAI', 'CLI', 'API', 'Local'];

const TYPE_ACCENT: Record<string, string> = {
  SmolAI: '#00e5cc',
  CLI: '#f59e0b',
  API: '#7c3aed',
  Local: '#22c55e',
};

const BG = '#0a0e17';
const PANEL = '#0d1420';
const SURFACE = '#111928';
const BORDER = '#1a2332';
const ACCENT = '#00e5cc';
const TEXT = '#e0e0e0';
const MUTED = '#4a6080';

const emptyForm = (): Partial<Agent> => ({
  name: '',
  type: 'SmolAI',
  model: '',
  description: '',
  system_prompt: '',
  capabilities: [],
  acpx_command: '',
});

export default function AgentManagerApp(_props: AppComponentProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [capInput, setCapInput] = useState('');

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/db/agents');
      if (res.ok) setAgents(await res.json());
    } catch {}
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/db/models');
      if (res.ok) setModels(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchAgents(); fetchModels(); }, [fetchAgents, fetchModels]);

  const byType = AGENT_TYPES.reduce<Record<string, Agent[]>>((acc, t) => {
    acc[t] = agents.filter((a) => (a.type ?? 'SmolAI') === t);
    return acc;
  }, {});

  const filteredModels = form.type
    ? models.filter((m) => !m.type || m.type === form.type || m.type === 'all')
    : models;

  const selectAgent = (a: Agent) => {
    setIsNew(false);
    setSelected(a);
    setForm({ ...a });
  };

  const startNew = () => {
    setIsNew(true);
    setSelected(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.name?.trim() || saving) return;
    setSaving(true);
    try {
      const url = isNew ? '/api/db/agents' : '/api/db/agents/' + selected!.id;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchAgents();
        if (isNew) { setIsNew(false); setSelected(null); }
      }
    } catch {}
    setSaving(false);
  };

  const deleteAgent = async () => {
    if (!selected) return;
    try {
      await fetch('/api/db/agents/' + selected.id, { method: 'DELETE' });
      setSelected(null);
      setForm(emptyForm());
      await fetchAgents();
    } catch {}
  };

  const addCap = () => {
    if (!capInput.trim()) return;
    setForm((p) => ({ ...p, capabilities: [...(p.capabilities ?? []), capInput.trim()] }));
    setCapInput('');
  };

  const removeCap = (i: number) => {
    setForm((p) => ({ ...p, capabilities: (p.capabilities ?? []).filter((_: string, j: number) => j !== i) }));
  };

  const setF = (key: keyof Agent, value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="flex h-full" style={{ background: BG, color: TEXT }}>
      {/* Left panel */}
      <div className="w-56 shrink-0 flex flex-col" style={{ borderRight: '1px solid ' + BORDER, background: PANEL }}>
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid ' + BORDER }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Agents</span>
          <button onClick={startNew}
            className="p-1 rounded hover:bg-white/5"
            style={{ color: ACCENT }}>
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {AGENT_TYPES.map((type) => (
            <div key={type}>
              {byType[type].length > 0 && (
                <>
                  <div className="px-3 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: TYPE_ACCENT[type] ?? MUTED }}>
                      {type}
                    </span>
                  </div>
                  {byType[type].map((agent) => (
                    <button key={agent.id}
                      onClick={() => selectAgent(agent)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
                      style={{
                        background: selected?.id === agent.id ? ACCENT + '10' : 'transparent',
                        borderLeft: '2px solid ' + (selected?.id === agent.id ? ACCENT : 'transparent'),
                      }}>
                      <Bot size={13} style={{ color: selected?.id === agent.id ? ACCENT : MUTED }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{agent.name}</p>
                        {agent.model && (
                          <p className="text-xs truncate" style={{ color: MUTED }}>{agent.model}</p>
                        )}
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: agent.status === 'active' ? '#22c55e' : MUTED }} />
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}
          {agents.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs" style={{ color: MUTED }}>Nenhum agente</span>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected && !isNew ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Bot size={32} style={{ color: MUTED }} />
            <p className="text-sm" style={{ color: MUTED }}>Selecione ou crie um agente</p>
            <button onClick={startNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: ACCENT, color: BG }}>
              <Plus size={14} /> Novo Agente
            </button>
          </div>
        ) : (
          <>
            {/* Form header */}
            <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
              style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
              <span className="text-sm font-semibold">
                {isNew ? 'Novo Agente' : (selected?.name ?? 'Editar Agente')}
              </span>
              <div className="flex gap-2">
                {!isNew && selected && (
                  <button onClick={deleteAgent}
                    className="px-2.5 py-1 rounded-lg text-xs"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444433' }}>
                    Deletar
                  </button>
                )}
                <button onClick={save} disabled={saving || !form.name?.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: ACCENT, color: BG, opacity: saving ? 0.6 : 1 }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>Nome *</label>
                  <input value={form.name ?? ''}
                    onChange={(e) => setF('name', e.target.value)}
                    placeholder="Nome do agente"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>Descrição</label>
                  <input value={form.description ?? ''}
                    onChange={(e) => setF('description', e.target.value)}
                    placeholder="Descrição breve"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                  />
                </div>
              </div>

              {/* Type + Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>Tipo</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {AGENT_TYPES.map((t) => (
                      <button key={t} onClick={() => setF('type', t)}
                        className="px-2.5 py-1 rounded-lg text-xs transition-colors"
                        style={{
                          background: form.type === t ? (TYPE_ACCENT[t] ?? ACCENT) + '20' : SURFACE,
                          color: form.type === t ? (TYPE_ACCENT[t] ?? ACCENT) : MUTED,
                          border: '1px solid ' + (form.type === t ? (TYPE_ACCENT[t] ?? ACCENT) + '44' : BORDER),
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: MUTED }}>Modelo</label>
                  <select value={form.model ?? ''}
                    onChange={(e) => setF('model', e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT }}>
                    <option value="">Selecionar modelo</option>
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* System prompt */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>System Prompt</label>
                <textarea value={form.system_prompt ?? ''}
                  onChange={(e) => setF('system_prompt', e.target.value)}
                  placeholder="Instruções do sistema para o agente..."
                  rows={6}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none font-mono"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                />
              </div>

              {/* ACPX command */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>ACPX Command</label>
                <input value={form.acpx_command ?? ''}
                  onChange={(e) => setF('acpx_command', e.target.value)}
                  placeholder="ex: node /opt/agent-os/agents/my-agent/index.js"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
                  style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: MUTED }}>Capabilities</label>
                <div className="flex gap-2 mb-2">
                  <input value={capInput}
                    onChange={(e) => setCapInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCap(); }}
                    placeholder="Adicionar capability..."
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT, userSelect: 'text' }}
                  />
                  <button onClick={addCap}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: SURFACE, color: ACCENT, border: '1px solid ' + ACCENT + '44' }}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(typeof form.capabilities === "string" ? JSON.parse(form.capabilities || "[]") : (form.capabilities ?? [])).map((cap: string, i: number) => (
                    <span key={i}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: ACCENT + '15', color: ACCENT, border: '1px solid ' + ACCENT + '33' }}>
                      {cap}
                      <button onClick={() => removeCap(i)} className="hover:opacity-70">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview row */}
              {!isNew && selected && (
                <div className="rounded-lg p-3" style={{ background: SURFACE, border: '1px solid ' + BORDER }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: MUTED }}>Info</p>
                  <div className="space-y-1">
                    {[
                      ['ID', selected.id],
                      ['Status', selected.status ?? 'unknown'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span style={{ color: MUTED }} className="w-16 shrink-0">{k}</span>
                        <span style={{ color: TEXT + 'aa' }} className="font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
