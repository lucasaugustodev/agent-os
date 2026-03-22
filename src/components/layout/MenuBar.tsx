import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';

export function MenuBar() {
  const [time, setTime] = useState(new Date());
  const [cpu] = useState(() => Math.floor(Math.random() * 15) + 5);
  const [mem] = useState(() => (Math.random() * 4 + 6).toFixed(1));
  const instances = useAppStore((s) => s.instances);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed top-4 right-5 flex items-center gap-4 z-[1001] select-none"
    >
      <div
        className="flex items-center gap-4 px-4 py-1.5 rounded-full text-[11px] tracking-wide"
        style={{
          background: 'rgba(10, 16, 28, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* CPU */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--os-text-muted)' }}>CPU</span>
          <span className="font-medium" style={{ color: 'var(--os-text)' }}>{cpu}%</span>
        </div>

        {/* MEM */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--os-text-muted)' }}>MEM</span>
          <span className="font-medium" style={{ color: 'var(--os-text)' }}>{mem}GB</span>
        </div>

        {/* Window count badge */}
        {instances.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--os-accent)' }}
            />
            <span style={{ color: 'var(--os-text-muted)' }}>{instances.length}</span>
          </div>
        )}

        {/* Time */}
        <span className="font-medium" style={{ color: 'var(--os-accent)' }}>{timeStr}</span>
      </div>
    </div>
  );
}
