import { useState, useEffect } from 'react';
import { Bot, Cpu } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export function MenuBar() {
  const [time, setTime] = useState(new Date());
  const foregroundInstanceId = useAppStore((s) => s.foregroundInstanceId);
  const instances = useAppStore((s) => s.instances);
  const foreground = instances.find((i) => i.instanceId === foregroundInstanceId);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 flex items-center px-4 gap-4 z-[1001] select-none"
      style={{
        background: 'var(--os-menubar)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-1.5 font-semibold text-xs" style={{ color: 'var(--os-accent)' }}>
        <Cpu size={14} />
        <span>AgentOS</span>
      </div>

      {/* Active app name */}
      {foreground && (
        <span className="text-xs font-medium" style={{ color: 'var(--os-text-muted)' }}>
          {foreground.title}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side - status */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--os-text-muted)' }}>
        <div className="flex items-center gap-1">
          <Bot size={12} />
          <span>{instances.length} open</span>
        </div>
        <span>{dateStr}</span>
        <span className="font-medium" style={{ color: 'var(--os-text)' }}>{timeStr}</span>
      </div>
    </div>
  );
}
