import { useState, useEffect, useRef } from 'react';
import {
  Database, Table, Play, Brain, Send, X, Loader2, RefreshCw,
  Globe, Pause, ChevronRight, Zap,
} from 'lucide-react';

import type { AppComponentProps } from '../../types/os';

interface Project {
  id: string;
  name: string;
  region: string;
  status: string;
  created_at: string;
  organization_id: string;
  database?: { host: string };
}

interface TableInfo {
  table_name: string;
  size: string;
  columns: string;
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

const REGION_LABELS: Record<string, string> = {
  'us-east-1': 'US East', 'us-west-1': 'US West', 'eu-west-1': 'EU West',
  'eu-central-1': 'EU Central', 'ap-southeast-1': 'AP SE', 'sa-east-1': 'SA East',
};

// ─── AI Sidebar ───
function SBSidebar({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(`sb-${Date.now()}`);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setThinking(true);
    setStatusText('Processando...');

    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, project_id: projectId, session_id: sessionIdRef.current, stream: true }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.event === 'status') setStatusText(evt.text);
            else if (evt.event === 'tool_call') setStatusText(`⚡ ${evt.args?.substring(0, 50)}...`);
            else if (evt.event === 'tool_result') setStatusText('✓ Concluido');
            else if (evt.event === 'done') finalResult = evt.result || '';
          } catch {}
        }
      }
      if (finalResult) setMessages(prev => [...prev, { role: 'assistant', text: finalResult }]);
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'Erro de conexao.' }]);
    }
    setThinking(false);
    setStatusText('');
  }

  return (
    <div className="flex flex-col h-full w-[280px] shrink-0"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,15,0.6)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Brain size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--os-text)' }}>Supabase AI</span>
        <button className="p-1 rounded hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={12} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Crie tabelas, rode SQL, gerencie projetos...
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[95%] px-2.5 py-1.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === 'user' ? 'rgba(0,229,204,0.12)' : 'rgba(255,255,255,0.04)',
                color: msg.role === 'system' ? 'var(--os-yellow)' : 'var(--os-text)',
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Loader2 size={10} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
              <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>{statusText || 'Working...'}</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about Supabase..."
          className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--os-text-muted)]"
          style={{ color: 'var(--os-text)' }} />
        <button className="p-1.5 rounded-lg cursor-pointer" onClick={handleSend}
          style={{ color: input.trim() ? 'var(--os-accent)' : 'var(--os-text-muted)' }}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── SQL Editor Overlay ───
function SQLEditor({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [query, setQuery] = useState('SELECT tablename FROM pg_tables WHERE schemaname = \'public\';');
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  async function runQuery() {
    setRunning(true);
    try {
      const res = await fetch(`/api/supabase/sql/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: 'Query failed' });
    }
    setRunning(false);
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(5,8,15,0.95)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Play size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-sm font-medium flex-1" style={{ color: 'var(--os-text)' }}>SQL Editor</span>
        <button className="px-3 py-1 rounded-lg text-xs cursor-pointer flex items-center gap-1"
          style={{ background: 'var(--os-accent)', color: '#0a0e17' }}
          onClick={runQuery} disabled={running}>
          <Play size={11} /> {running ? 'Running...' : 'Run'}
        </button>
        <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={16} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      {/* Query input */}
      <textarea value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
        className="px-4 py-3 bg-transparent resize-none outline-none text-[13px] leading-relaxed"
        style={{ color: 'var(--os-text)', fontFamily: "'JetBrains Mono', monospace", height: 120, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        placeholder="SELECT * FROM ..." />
      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {result === null ? (
          <p className="text-center text-xs py-8" style={{ color: 'var(--os-text-muted)' }}>Ctrl+Enter pra executar</p>
        ) : result.error ? (
          <p className="text-xs" style={{ color: 'var(--os-red)' }}>{typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}</p>
        ) : Array.isArray(result) && result.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {Object.keys(result[0]).map(k => (
                    <th key={k} className="text-left px-3 py-1.5 font-medium" style={{ color: 'var(--os-accent)' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.map((row: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {Object.values(row).map((v: any, j) => (
                      <td key={j} className="px-3 py-1.5" style={{ color: 'var(--os-text)' }}>
                        {v === null ? <span style={{ color: 'var(--os-text-muted)' }}>null</span> : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] mt-2" style={{ color: 'var(--os-text-muted)' }}>{result.length} rows</p>
          </div>
        ) : (
          <pre className="text-[11px] whitespace-pre-wrap" style={{ color: 'var(--os-text)' }}>{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ───
function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!token.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/supabase/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.ok) onLoggedIn();
      else setError(data.error || 'Login failed');
    } catch { setError('Connection error'); }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center h-full" style={{ background: '#0a0e17' }}>
      <div className="w-80 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Database size={28} className="mx-auto mb-3" style={{ color: '#3ecf8e' }} />
        <h2 className="text-center text-sm font-semibold mb-1" style={{ color: 'var(--os-text)' }}>Supabase Login</h2>
        <p className="text-center text-[11px] mb-4" style={{ color: 'var(--os-text-muted)' }}>
          Cole seu Access Token do Supabase
        </p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          placeholder="sbp_xxxxxxxxxxxx"
          className="w-full px-3 py-2 rounded-lg text-xs bg-transparent outline-none mb-3"
          style={{ color: 'var(--os-text)', border: '1px solid rgba(255,255,255,0.08)' }} />
        {error && <p className="text-[11px] mb-2" style={{ color: 'var(--os-red)' }}>{error}</p>}
        <button className="w-full py-2 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: '#3ecf8e', color: '#0a0e17' }}
          onClick={handleLogin} disabled={loading}>
          {loading ? 'Autenticando...' : 'Entrar'}
        </button>
        <p className="text-center text-[10px] mt-3" style={{ color: 'var(--os-text-muted)' }}>
          Gere em supabase.com/dashboard/account/tokens
        </p>
      </div>
    </div>
  );
}

// ─── Main Supabase App ───
export default function SupabaseApp(_props: AppComponentProps) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [viewingTable, setViewingTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/supabase/auth').then(r => r.json()).then(d => {
      setAuthed(d.loggedIn);
      if (d.loggedIn) loadProjects();
      else setLoading(false);
    }).catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase/projects');
      setProjects(await res.json());
    } catch {}
    setLoading(false);
  }

  async function selectProject(p: Project) {
    setSelectedProject(p);
    setLoading(true);
    try {
      const res = await fetch(`/api/supabase/tables/${p.id}`);
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch { setTables([]); }
    setLoading(false);
  }

  async function viewTable(tableName: string) {
    if (!selectedProject) return;
    setViewingTable(tableName);
    setLoading(true);
    try {
      const res = await fetch(`/api/supabase/sql/${selectedProject.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT * FROM "${tableName}" LIMIT 100` }),
      });
      const data = await res.json();
      setTableData(Array.isArray(data) ? data : []);
    } catch { setTableData([]); }
    setLoading(false);
  }

  if (authed === null) return <div className="flex items-center justify-center h-full" style={{ background: '#0a0e17' }}><Loader2 size={20} className="animate-spin" style={{ color: '#3ecf8e' }} /></div>;
  if (!authed) return <LoginScreen onLoggedIn={() => { setAuthed(true); loadProjects(); }} />;

  const statusColor = (s: string) =>
    s === 'ACTIVE_HEALTHY' ? '#3ecf8e' :
    s === 'INACTIVE' ? 'var(--os-yellow)' :
    'var(--os-red)';

  return (
    <div className="flex h-full relative" style={{ background: '#0a0e17' }}>
      <div className="flex flex-col flex-1 min-w-0">
        {/* SQL Editor */}
        {showSQL && selectedProject && (
          <SQLEditor projectId={selectedProject.id} onClose={() => setShowSQL(false)} />
        )}

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Database size={15} style={{ color: '#3ecf8e' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>Supabase</span>

          {selectedProject && (
            <>
              <ChevronRight size={12} style={{ color: 'var(--os-text-muted)' }} />
              <span className="text-[11px]" style={{ color: '#3ecf8e' }}>{selectedProject.name}</span>
              {viewingTable && (
                <>
                  <ChevronRight size={12} style={{ color: 'var(--os-text-muted)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--os-text)' }}>{viewingTable}</span>
                </>
              )}
              <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer ml-2"
                style={{ background: 'rgba(62,207,142,0.1)', color: '#3ecf8e' }}
                onClick={() => setShowSQL(true)}>
                <Play size={10} /> SQL
              </button>
            </>
          )}

          <div className="flex-1" />

          {viewingTable && (
            <button className="text-[11px] cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5"
              style={{ color: 'var(--os-text-muted)' }}
              onClick={() => { setViewingTable(null); setTableData([]); }}>
              ← Tables
            </button>
          )}
          {selectedProject && !viewingTable && (
            <button className="text-[11px] cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5"
              style={{ color: 'var(--os-text-muted)' }}
              onClick={() => { setSelectedProject(null); setTables([]); }}>
              ← Projects
            </button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
            style={{ color: 'var(--os-text-muted)' }}
            onClick={() => selectedProject ? selectProject(selectedProject) : loadProjects()}>
            <RefreshCw size={12} />
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{
              background: showAI ? '#3ecf8e' : 'rgba(255,255,255,0.04)',
              color: showAI ? '#0a0e17' : 'var(--os-text-muted)',
            }}
            onClick={() => setShowAI(!showAI)}>
            <Brain size={13} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin" style={{ color: '#3ecf8e' }} />
            </div>
          ) : viewingTable ? (
            /* Table data view */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Table size={14} style={{ color: '#3ecf8e' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--os-text)' }}>{viewingTable}</span>
                <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>{tableData.length} rows (limit 100)</span>
              </div>
              {tableData.length > 0 ? (
                <div className="overflow-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                  <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {Object.keys(tableData[0]).map(k => (
                          <th key={k} className="text-left px-3 py-2 font-medium whitespace-nowrap"
                            style={{ color: '#3ecf8e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          {Object.values(row).map((v: any, j) => (
                            <td key={j} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate" style={{ color: 'var(--os-text)' }}>
                              {v === null ? <span style={{ color: 'var(--os-text-muted)', fontStyle: 'italic' }}>null</span> : String(v).substring(0, 100)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-xs" style={{ color: 'var(--os-text-muted)' }}>Table is empty</p>
              )}
            </div>
          ) : !selectedProject ? (
            /* Projects list */
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => selectProject(p)}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor(p.status) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: '#3ecf8e' }}>{p.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}>
                        {REGION_LABELS[p.region] || p.region}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>{p.id.substring(0, 8)}</span>
                      <span>{p.status === 'ACTIVE_HEALTHY' ? 'Active' : p.status}</span>
                      <span>{timeAgo(p.created_at)} ago</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                      style={{ background: 'rgba(62,207,142,0.08)', color: '#3ecf8e' }}
                      onClick={(e) => { e.stopPropagation(); selectProject(p); }}>
                      <Table size={10} /> Tables
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="text-center py-16" style={{ color: 'var(--os-text-muted)' }}>
                  <Database size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <p className="text-xs">No projects found</p>
                </div>
              )}
            </div>
          ) : (
            /* Tables view */
            <div className="space-y-2">
              {tables.map(t => (
                <div key={t.table_name}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => viewTable(t.table_name)}>
                  <Table size={14} style={{ color: '#3ecf8e' }} />
                  <div className="flex-1">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{t.table_name}</span>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>{t.columns} columns</span>
                      <span>{t.size}</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                    style={{ background: 'rgba(62,207,142,0.08)', color: '#3ecf8e' }}
                    onClick={(e) => { e.stopPropagation(); setShowSQL(true); }}>
                    <Play size={10} /> SQL
                  </button>
                </div>
              ))}
              {tables.length === 0 && (
                <div className="text-center py-16" style={{ color: 'var(--os-text-muted)' }}>
                  <Table size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <p className="text-xs">No tables in public schema</p>
                  <p className="text-[10px] mt-1">Use the SQL editor or AI to create tables</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Sidebar */}
      {showAI && <SBSidebar projectId={selectedProject?.id || null} onClose={() => setShowAI(false)} />}
    </div>
  );
}
