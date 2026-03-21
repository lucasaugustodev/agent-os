import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Globe } from 'lucide-react';
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

export default function BrowserApp({ data }: AppComponentProps) {
  const [browserId, setBrowserId] = useState<string | null>(null);
  const [url, setUrl] = useState((data as { url?: string })?.url || 'https://www.google.com');
  const [addressBar, setAddressBar] = useState(url);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const viewportRef = useRef({ width: 1024, height: 576 });
  const blobUrlRef = useRef<string>('');

  // Create browser session
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

  // WebSocket connection
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
      // Revoke old blob URL to free memory
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };

    ws.onmessage = (event) => {
      // Binary frame: 1 byte type + 36 bytes id + JPEG data
      if (event.data instanceof ArrayBuffer) {
        if (pendingFrame) return; // Skip frame if previous not drawn yet
        setLoading(false);
        const buf = event.data as ArrayBuffer;
        const jpeg = buf.slice(37); // Skip header
        const blob = new Blob([jpeg], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        pendingFrame = true;
        img.src = url;
        return;
      }

      // JSON messages
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

  // Cleanup session on unmount
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
    <div className="flex flex-col h-full" style={{ background: '#1e1e2e' }}>
      {/* Nav bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 shrink-0"
        style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
        <button className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--os-text-muted)' }}
          onClick={() => send({ type: 'browser:back' })}><ArrowLeft size={14} /></button>
        <button className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--os-text-muted)' }}
          onClick={() => send({ type: 'browser:forward' })}><ArrowRight size={14} /></button>
        <button className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--os-text-muted)' }}
          onClick={() => send({ type: 'browser:reload' })}><RotateCw size={14} /></button>
        <div className="flex-1 flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
          style={{ background: 'var(--os-surface)' }}>
          <Globe size={11} style={{ color: 'var(--os-text-muted)', flexShrink: 0 }} />
          <input type="text" value={addressBar}
            onChange={(e) => setAddressBar(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(addressBar); }}
            className="flex-1 bg-transparent outline-none text-xs select-text"
            style={{ color: 'var(--os-text)', userSelect: 'text' }} spellCheck={false} />
        </div>
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: connected ? 'var(--os-green)' : 'var(--os-red)' }} />
      </div>

      {/* Viewport */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#1e1e2e' }}>
            <div className="flex flex-col items-center gap-2" style={{ color: 'var(--os-text-muted)' }}>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
  );
}
