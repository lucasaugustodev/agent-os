import { Suspense } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';
import { WindowFrame } from './WindowFrame';
import { Dock } from './Dock';
import { MenuBar } from './MenuBar';
import type { AppComponentProps } from '../../types/os';

// Sidebar app definitions matching the old design
const SIDEBAR_APPS = [
  { id: 'smol-chat', emoji: '🤖', label: 'Agent OS' },
  { id: 'threads', emoji: '📋', label: 'Threads' },
  { id: 'knowledge', emoji: '🧠', label: 'Knowledge' },
  { id: 'flows', emoji: '🔀', label: 'Flows' },
  { id: 'agent-manager', emoji: '🤖', label: 'Agent Manager' },
  { id: 'terminal', emoji: '>', label: 'Terminal' },
  { id: 'browser', emoji: '◎', label: 'Browser' },
  { id: 'file-explorer', emoji: '📁', label: 'Filesystem' },
  { id: 'docker', emoji: '🐳', label: 'Docker' },
  { id: 'pm2-manager', emoji: '⚡', label: 'PM2' },
  { id: 'supabase', emoji: '◆', label: 'Supabase' },
  { id: 'github-cli', emoji: '⌥', label: 'GitHub' },
  { id: 'settings', emoji: '⚙', label: 'Settings' },
];

function Sidebar() {
  const launchApp = useAppStore((s) => s.launchApp);
  const registry = getRegistry();

  return (
    <div className="absolute top-14 right-4 flex flex-col gap-3 z-[5]">
      {SIDEBAR_APPS.map((item) => (
        <button
          key={item.id}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-white/8 cursor-pointer group"
          style={{ width: '72px' }}
          onClick={(e) => {
            e.stopPropagation();
            const entry = registry.find((a) => a.id === item.id);
            if (entry) {
              launchApp(item.id, { title: entry.name, size: entry.defaultSize });
            }
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all group-hover:scale-105"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: 'var(--os-accent)',
            }}
          >
            {item.emoji}
          </div>
          <span
            className="text-[9px] text-center leading-tight opacity-70 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--os-text)' }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function WindowLoader({ instanceId }: { instanceId: string }) {
  const instance = useAppStore((s) => s.instances.find((i) => i.instanceId === instanceId));
  if (!instance) return null;

  const registry = getRegistry();
  const entry = registry.find((a) => a.id === instance.appId);
  if (!entry) return null;

  const Component = entry.component as React.LazyExoticComponent<React.ComponentType<AppComponentProps>>;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--os-text-muted)' }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        </div>
      }
    >
      <Component
        instanceId={instance.instanceId}
        appId={instance.appId}
        data={instance.data}
      />
    </Suspense>
  );
}

export function Desktop() {
  const instances = useAppStore((s) => s.instances);
  const foregroundInstanceId = useAppStore((s) => s.foregroundInstanceId);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none desktop-bg"
      style={{ background: 'var(--os-desktop)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          useAppStore.setState({ foregroundInstanceId: null });
        }
      }}
    >
      <MenuBar />

      {/* Right-side sidebar icons */}
      <Sidebar />

      {/* Windows */}
      {instances.map((instance) => {
        const entry = getRegistry().find((a) => a.id === instance.appId);
        return (
          <WindowFrame
            key={instance.instanceId}
            instanceId={instance.instanceId}
            appId={instance.appId}
            title={instance.title}
            isForeground={instance.instanceId === foregroundInstanceId}
            minSize={entry?.minSize}
          >
            <WindowLoader instanceId={instance.instanceId} />
          </WindowFrame>
        );
      })}

      <Dock />
    </div>
  );
}
