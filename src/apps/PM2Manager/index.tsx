import { useState, useEffect, useRef } from 'react';
import {
  Play, Square, RotateCcw, Trash2, FileText, Brain,
  Send, X, Loader2, Activity,
} from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Process {
  id: number;
  name: string;
  status: string;
  pid: number;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  user: string;
}

function formatMem(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(ts: number): string {
  if (!ts) return '-';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── SmolAgent Sidebar ───
function AISidebar({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setThinking(true);

    const prompt = `[Contexto: gerenciamento de processos PM2 no servidor Linux. O user claude roda launcher e smol-daemon. O root roda agent-os. Use "sudo -u claude pm2" ou "pm2" conforme o user.] ${text}`;
    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.result || data.error || 'No response' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'Connection error.' }]);
    }
    setThinking(false);
  }

  return (
    <div className="flex flex-col h-full w-[280px] shrink-0"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,15,0.6)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Brain size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--os-text)' }}>PM2 Assistant</span>
        <button className="p-1 rounded hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={12} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Peça pra iniciar serviços, ver logs, debugar erros...
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
              <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>Working...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about PM2..."
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

// ─── Log Viewer Overlay ───
function LogViewer({ name, user, onClose }: { name: string; user: string; onClose: () => void }) {
  const [logs, setLogs] = useState('Loading...');

  useEffect(() => {
    fetch(`/api/pm2/logs/${name}?user=${user}`)
      .then(r => r.json())
      .then(d => setLogs(d.logs || 'No logs'))
      .catch(() => setLogs('Error loading logs'));
  }, [name, user]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(5,8,15,0.95)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <FileText size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-sm font-medium flex-1" style={{ color: 'var(--os-text)' }}>
          Logs: {name}
        </span>
        <button className="px-2.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-white/5"
          style={{ color: 'var(--os-text-muted)' }}
          onClick={() => {
            fetch(`/api/pm2/logs/${name}?user=${user}`)
              .then(r => r.json())
              .then(d => setLogs(d.logs || 'No logs'));
          }}>
          <RotateCcw size={12} />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={16} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed whitespace-pre-wrap"
        style={{ color: 'var(--os-text)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
        {logs}
      </pre>
    </div>
  );
}

// ─── Main PM2 Manager ───
export default function PM2Manager(_props: AppComponentProps) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssistant, setShowAssistant] = useState(false);
  const [viewLogs, setViewLogs] = useState<{ name: string; user: string } | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const loadProcesses = async () => {
    try {
      const res = await fetch('/api/pm2/list');
      setProcesses(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadProcesses();
    const iv = setInterval(loadProcesses, 5000);
    return () => clearInterval(iv);
  }, []);

  async function handleAction(action: string, name: string, user: string) {
    setActing(name);
    try {
      await fetch('/api/pm2/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name, user }),
      });
      await loadProcesses();
    } catch {}
    setActing(null);
  }

  const statusColor = (s: string) =>
    s === 'online' ? 'var(--os-accent)' :
    s === 'stopped' ? 'var(--os-red)' :
    s === 'errored' ? 'var(--os-red)' :
    'var(--os-yellow)';

  return (
    <div className="flex h-full relative" style={{ background: '#0a0e17' }}>
      <div className="flex flex-col flex-1 min-w-0">
        {/* Log viewer overlay */}
        {viewLogs && <LogViewer name={viewLogs.name} user={viewLogs.user} onClose={() => setViewLogs(null)} />}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Activity size={15} style={{ color: 'var(--os-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>PM2 Processes</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,229,204,0.1)', color: 'var(--os-accent)' }}>
            {processes.filter(p => p.status === 'online').length} online
          </span>
          <div className="flex-1" />
          <button className="px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5"
            style={{ color: 'var(--os-text-muted)' }}
            onClick={loadProcesses}>
            <RotateCcw size={12} />
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{
              background: showAssistant ? 'var(--os-accent)' : 'rgba(255,255,255,0.04)',
              color: showAssistant ? '#0a0e17' : 'var(--os-text-muted)',
            }}
            onClick={() => setShowAssistant(!showAssistant)}
            title="PM2 Assistant (SmolAgent)">
            <Brain size={13} />
          </button>
        </div>

        {/* Process list */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {processes.map((proc) => (
                <div key={`${proc.user}-${proc.name}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor(proc.status) }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--os-text)' }}>{proc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}>
                        {proc.user}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>PID {proc.pid}</span>
                      <span>CPU {proc.cpu}%</span>
                      <span>{formatMem(proc.memory)}</span>
                      <span>Up {formatUptime(proc.uptime)}</span>
                      {proc.restarts > 0 && <span>↻ {proc.restarts}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}
                      onClick={() => setViewLogs({ name: proc.name, user: proc.user })}>
                      <FileText size={11} /> Logs
                    </button>
                    {proc.status === 'online' ? (
                      <>
                        <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                          style={{ background: 'rgba(0,229,204,0.08)', color: 'var(--os-accent)' }}
                          disabled={acting === proc.name}
                          onClick={() => handleAction('restart', proc.name, proc.user)}>
                          <RotateCcw size={11} /> {acting === proc.name ? '...' : 'Restart'}
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                          style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--os-red)' }}
                          disabled={acting === proc.name}
                          onClick={() => handleAction('stop', proc.name, proc.user)}>
                          <Square size={11} /> Stop
                        </button>
                      </>
                    ) : (
                      <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                        style={{ background: 'rgba(0,229,204,0.08)', color: 'var(--os-accent)' }}
                        disabled={acting === proc.name}
                        onClick={() => handleAction('start', proc.name, proc.user)}>
                        <Play size={11} /> Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {processes.length === 0 && (
                <div className="text-center py-16" style={{ color: 'var(--os-text-muted)' }}>
                  <Activity size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <p className="text-xs">No PM2 processes found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Sidebar */}
      {showAssistant && <AISidebar onClose={() => setShowAssistant(false)} />}
    </div>
  );
}
