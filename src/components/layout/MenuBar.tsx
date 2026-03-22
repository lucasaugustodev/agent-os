import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';

export function MenuBar() {
  const [time, setTime] = useState(new Date());
  const instances = useAppStore((s) => s.instances);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 flex items-center px-4 gap-4 z-[1001] select-none"
      style={{
        background: 'var(--os-menubar)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* AgentOS branding */}
      <div
        className="flex items-center gap-1.5 text-sm font-semibold tracking-wide"
        style={{ color: 'var(--os-accent)' }}
      >
        <span
          className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'var(--os-accent)', color: '#0a0e17' }}
        >
          A
        </span>
        <span>AgentOS</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side: open count + date/time */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--os-text-muted)' }}>
        <span>{instances.length} open</span>
        <span>{dateStr}</span>
        <span className="font-medium" style={{ color: 'var(--os-text)' }}>
          {timeStr}
        </span>
      </div>
    </div>
  );
}
