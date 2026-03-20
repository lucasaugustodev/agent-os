import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Play, Square, Plus } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';
import '@xterm/xterm/css/xterm.css';

const WS_URL = `ws://${window.location.host}/ws`;
const API_BASE = '/api/launcher';

interface Profile { id: string; name: string; workingDirectory: string; mode: string; }
interface SessionInfo { id: string; profileName?: string; status: string; pid: number; }

export default function TerminalApp({ data }: AppComponentProps) {
  const termContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const pendingSessionId = useRef<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runningSessions, setRunningSessions] = useState<SessionInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  // Fetch profiles and sessions
  useEffect(() => {
    const load = () => {
      fetch(`${API_BASE}/profiles`).then(r => r.json()).then(setProfiles).catch(() => {});
      fetch(`${API_BASE}/sessions`).then(r => r.json()).then(setRunningSessions).catch(() => {});
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  // Auto-attach if launched with sessionId
  useEffect(() => {
    const sid = (data as { sessionId?: string })?.sessionId;
    if (sid) openSession(sid);
  }, []); // eslint-disable-line

  // Auto-launch if opened with agentName
  useEffect(() => {
    const agName = (data as { agentName?: string })?.agentName;
    if (!agName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/claude-agents/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName: agName,
            workingDirectory: '/home/claude/workspace',
            mode: 'normal',
          }),
        });
        const session = await res.json();
        if (!cancelled && session.id) openSession(session.id);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // Callback ref - fires when the terminal div is mounted/unmounted
  const termCallbackRef = useCallback((el: HTMLDivElement | null) => {
    termContainerRef.current = el;
    if (!el) return;

    // Init xterm when the div appears
    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        theme: {
          background: '#0a0e17', foreground: '#e0e6f0', cursor: '#00e5cc',
          selectionBackground: '#00e5cc33',
          black: '#1a1f2e', red: '#ff4d6a', green: '#00e5cc',
          yellow: '#ffb84d', blue: '#4d9fff', magenta: '#a855f7',
          cyan: '#00e5cc', white: '#e0e6f0',
          brightBlack: '#3a4050', brightRed: '#ff6b85', brightGreen: '#33eedd',
          brightYellow: '#ffc966', brightBlue: '#66b3ff', brightMagenta: '#b975f9',
          brightCyan: '#33eedd', brightWhite: '#f0f4fa',
        },
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(el);
      xtermRef.current = term;
      fitRef.current = fit;

      const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
      ro.observe(el);
      roRef.current = ro;

      setTimeout(() => { try { fit.fit(); } catch {} }, 200);
    }

    // Connect to pending session
    if (pendingSessionId.current) {
      const sid = pendingSessionId.current;
      pendingSessionId.current = null;
      setTimeout(() => connectWs(sid), 300);
    }
  }, []); // eslint-disable-line

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (roRef.current) roRef.current.disconnect();
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, []);

  function connectWs(sessionId: string) {
    const term = xtermRef.current;
    if (!term) return;

    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    term.clear();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'attach', sessionId }));
      setTimeout(() => {
        try { fitRef.current?.fit(); } catch {}
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }));
        }
      }, 300);
    };

    ws.onmessage = (event) => {
      try {
        const str = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
        const msg = JSON.parse(str);
        if (msg.type === 'output') term.write(msg.data);
        else if (msg.type === 'exit') {
          term.write(`\r\n\x1b[90m[Session ended - code ${msg.exitCode}]\x1b[0m\r\n`);
          setConnected(false);
        }
      } catch {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    term.onData((d) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'input', sessionId, data: d }));
    });
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', sessionId, cols, rows }));
    });
  }

  function openSession(sessionId: string) {
    pendingSessionId.current = sessionId;
    setShowTerminal(true);
  }

  async function launchSession(profileId: string) {
    try {
      const res = await fetch(`${API_BASE}/sessions/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const session = await res.json();
      if (session.id) openSession(session.id);
    } catch {}
  }

  function backToLauncher() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setConnected(false);
    setShowTerminal(false);
    xtermRef.current?.clear();
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0e17', color: 'var(--os-text)' }}>
      {/* Toolbar */}
      {showTerminal && (
        <div className="flex items-center gap-3 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
          <button className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--os-text-muted)' }}
            onClick={backToLauncher} title="Back"><Plus size={14} /></button>
          <button className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--os-red)' }}
            onClick={() => {
              if (wsRef.current) wsRef.current.close();
            }} title="Disconnect"><Square size={12} /></button>
          <div className="flex-1" />
          <div className="w-2 h-2 rounded-full shrink-0"
            style={{ background: connected ? 'var(--os-green)' : 'var(--os-red)' }} />
        </div>
      )}

      {/* Launcher */}
      {!showTerminal && (
        <div className="flex-1 overflow-auto px-8 py-6">
          {runningSessions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider"
                style={{ color: 'var(--os-text-muted)' }}>Active Sessions</h3>
              {runningSessions.map((s) => (
                <button key={s.id}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left hover:bg-white/5 cursor-pointer mb-1.5"
                  onClick={() => openSession(s.id)}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--os-green)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.profileName || 'Session'}</div>
                    <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>PID {s.pid}</div>
                  </div>
                  <Play size={14} style={{ color: 'var(--os-accent)' }} />
                </button>
              ))}
            </div>
          )}
          <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider"
            style={{ color: 'var(--os-text-muted)' }}>Launch New Session</h3>
          {profiles.map((p) => (
            <button key={p.id}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl w-full text-left hover:bg-white/5 cursor-pointer mb-1.5"
              onClick={() => launchSession(p.id)}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: 'rgba(137,180,250,0.1)', color: 'var(--os-accent)' }}>{'>_'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--os-text-muted)' }}>{p.workingDirectory}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--os-surface)', color: 'var(--os-text-muted)' }}>{p.mode}</span>
            </button>
          ))}
          {profiles.length === 0 && (
            <div className="text-sm text-center py-8" style={{ color: 'var(--os-text-muted)' }}>No profiles configured.</div>
          )}
        </div>
      )}

      {/* Terminal container - only rendered when showTerminal */}
      {showTerminal && (
        <div ref={termCallbackRef} className="flex-1 overflow-hidden" style={{ padding: '4px' }} />
      )}
    </div>
  );
}
