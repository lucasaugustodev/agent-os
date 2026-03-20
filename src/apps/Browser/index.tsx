import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Globe, Brain, Send, X, Loader2 } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

const WS_URL = `ws://${window.location.host}/ws`;

function mapKey(e: KeyboardEvent): string {
  const map: Record<string, string> = {
    Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab',
    Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    Delete: 'Delete', Home: 'Home', End: 'End',
    PageUp: 'PageUp', PageDown: 'PageDown', ' ': 'Space',
    Control: 'Control', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta',
  };
  return map[e.key] || e.key;
}

// ─── Browser AI Sidebar ───
function BrowserAI({ browserId, onClose }: { browserId: string; onClose: () => void }) {
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

    // Get current page context
    let pageContext = '';
    try {
      const res = await fetch(`/api/browsers/${browserId}/text`);
      const data = await res.json();
      pageContext = `Título: ${data.title}\nURL: ${data.url}\n\nElementos interativos:\n${data.elements || 'nenhum'}\n\nTexto visível:\n${(data.text || '').substring(0, 1500)}`;
    } catch {
      pageContext = 'Não foi possível ler a página.';
    }

    const B = `http://localhost:3000/api/browsers/${browserId}`;
    const prompt = `[Browser AI. Responda em português. Execute ações com curl via shell tool.

Página atual:
${pageContext}

Comandos disponíveis:
- Navegar: curl -s -X POST ${B}/navigate -H 'Content-Type: application/json' -d '{"url":"URL"}'
- Clicar seletor: curl -s -X POST ${B}/click -H 'Content-Type: application/json' -d '{"selector":"CSS_SELECTOR"}'
- Clicar XY: curl -s -X POST ${B}/click -H 'Content-Type: application/json' -d '{"x":X,"y":Y}'
- Preencher campo: curl -s -X POST ${B}/type -H 'Content-Type: application/json' -d '{"selector":"SELECTOR","text":"TEXTO"}'
- Tecla: curl -s -X POST ${B}/press -H 'Content-Type: application/json' -d '{"key":"Enter"}'
- Ler página: curl -s ${B}/text]

${text}`;

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
        <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--os-text)' }}>Browser AI</span>
        <button className="p-1 rounded hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={12} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Peça pra navegar, clicar, preencher formulários, extrair dados...
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
              <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>Browsing...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Control browser..."
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

// ─── Main Browser ───
export default function BrowserApp({ data }: AppComponentProps) {
  const [browserId, setBrowserId] = useState<string | null>(null);
  const [url, setUrl] = useState((data as { url?: string })?.url || 'https://www.google.com');
  const [addressBar, setAddressBar] = useState(url);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const viewportRef = useRef({ width: 1024, height: 576 });
  const blobUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/browsers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const d = await res.json();
        if (!cancelled) {
          setBrowserId(d.id);
          setUrl(d.url);
          setAddressBar(d.url);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!browserId) return;
    const ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'browser:subscribe', browserId }));
    };
    ws.onclose = () => setConnected(false);

    const img = new Image();
    let pendingFrame = false;

    img.onload = () => {
      pendingFrame = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        viewportRef.current = { width: img.naturalWidth, height: img.naturalHeight };
      }
      ctx.drawImage(img, 0, 0);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        if (pendingFrame) return;
        setLoading(false);
        const buf = event.data as ArrayBuffer;
        const jpeg = buf.slice(37);
        const blob = new Blob([jpeg], { type: 'image/jpeg' });
        const u = URL.createObjectURL(blob);
        blobUrlRef.current = u;
        pendingFrame = true;
        img.src = u;
        return;
      }
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'browser:navigated' && msg.browserId === browserId) {
          setUrl(msg.url);
          setAddressBar(msg.url);
        }
        if (msg.type === 'browser:info') {
          viewportRef.current = msg.viewport;
        }
      } catch {}
    };

    return () => {
      try { ws.send(JSON.stringify({ type: 'browser:unsubscribe', browserId })); } catch {}
      ws.close();
      wsRef.current = null;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [browserId]);

  useEffect(() => {
    return () => {
      if (browserId) fetch(`/api/browsers/${browserId}`, { method: 'DELETE' }).catch(() => {});
    };
  }, [browserId]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1 && browserId) {
      ws.send(JSON.stringify({ ...msg, browserId }));
    }
  }, [browserId]);

  const toViewport = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = viewportRef.current.width / rect.width;
    const scaleY = viewportRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleNavigate = (input: string) => {
    let u = input.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = u.includes('.') && !u.includes(' ')
        ? 'https://' + u
        : 'https://www.google.com/search?q=' + encodeURIComponent(u);
    }
    setAddressBar(u);
    send({ type: 'browser:navigate', url: u });
    setLoading(true);
  };

  return (
    <div className="flex h-full" style={{ background: '#0a0e17' }}>
      <div className="flex flex-col flex-1 min-w-0">
        {/* Nav bar */}
        <div className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <button className="p-1.5 rounded hover:bg-white/10 cursor-pointer" style={{ color: 'var(--os-text-muted)' }}
            onClick={() => send({ type: 'browser:back' })}><ArrowLeft size={14} /></button>
          <button className="p-1.5 rounded hover:bg-white/10 cursor-pointer" style={{ color: 'var(--os-text-muted)' }}
            onClick={() => send({ type: 'browser:forward' })}><ArrowRight size={14} /></button>
          <button className="p-1.5 rounded hover:bg-white/10 cursor-pointer" style={{ color: 'var(--os-text-muted)' }}
            onClick={() => send({ type: 'browser:reload' })}><RotateCw size={14} /></button>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Globe size={11} style={{ color: 'var(--os-text-muted)', flexShrink: 0 }} />
            <input type="text" value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(addressBar); }}
              className="flex-1 bg-transparent outline-none text-xs select-text"
              style={{ color: 'var(--os-text)', userSelect: 'text' }} spellCheck={false} />
          </div>
          <div className="w-2 h-2 rounded-full shrink-0"
            style={{ background: connected ? 'var(--os-accent)' : 'var(--os-red)' }} />
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{
              background: showAI ? 'var(--os-accent)' : 'rgba(255,255,255,0.04)',
              color: showAI ? '#0a0e17' : 'var(--os-text-muted)',
            }}
            onClick={() => setShowAI(!showAI)}
            title="Browser AI">
            <Brain size={13} />
          </button>
        </div>

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#0a0e17' }}>
              <div className="flex flex-col items-center gap-2" style={{ color: 'var(--os-text-muted)' }}>
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--os-accent)', borderTopColor: 'transparent' }} />
                <span className="text-xs">Loading...</span>
              </div>
            </div>
          )}
          <canvas ref={canvasRef}
            className="w-full h-full"
            style={{ objectFit: 'contain' }}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); send({ type: 'browser:click', ...toViewport(e) }); }}
            onDoubleClick={(e) => { e.stopPropagation(); send({ type: 'browser:dblclick', ...toViewport(e) }); }}
            onMouseDown={(e) => { e.stopPropagation(); canvasRef.current?.focus(); }}
            onWheel={(e) => { send({ type: 'browser:scroll', deltaX: e.deltaX, deltaY: e.deltaY }); }}
            onKeyDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              const key = mapKey(e.nativeEvent);
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                send({ type: 'browser:keypress', text: e.key, key });
              } else {
                send({ type: 'browser:keydown', key });
              }
            }}
            onKeyUp={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (e.key.length > 1 || e.ctrlKey || e.metaKey) {
                send({ type: 'browser:keyup', key: mapKey(e.nativeEvent) });
              }
            }}
          />
        </div>
      </div>

      {/* AI Sidebar */}
      {showAI && browserId && <BrowserAI browserId={browserId} onClose={() => setShowAI(false)} />}
    </div>
  );
}
