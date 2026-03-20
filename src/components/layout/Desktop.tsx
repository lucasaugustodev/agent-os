import { Suspense } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';
import { WindowFrame } from './WindowFrame';
import { Dock } from './Dock';
import { MenuBar } from './MenuBar';
import { GestorChat } from './GestorChat';
import type { AppComponentProps } from '../../types/os';

const DESKTOP_ICONS: { id: string; label: string; emoji: string }[] = [
  { id: 'agents', label: 'Fleet Monitor', emoji: '⊞' },
  { id: 'terminal', label: 'Neural Terminal', emoji: '>' },
  { id: 'browser', label: 'Browser', emoji: '◎' },
  { id: 'finder', label: 'Filesystem', emoji: '📁' },
  { id: 'docker', label: 'Docker', emoji: '🐳' },
  { id: 'smol', label: 'SmolAgent', emoji: '🧠' },
  { id: 'pm2', label: 'PM2', emoji: '⚡' },
  { id: 'supabase', label: 'Supabase', emoji: '◆' },
  { id: 'github', label: 'GitHub', emoji: '⌥' },
  { id: 'settings', label: 'Settings', emoji: '⚙' },
];

function DesktopIcons() {
  const launchApp = useAppStore((s) => s.launchApp);
  const pinnedAgents = useAppStore((s) => s.pinnedAgents);
  const registry = getRegistry();

  function handleIconClick(id: string) {
    const entry = registry.find(a => a.id === id);
    if (entry) {
      launchApp(id, { title: entry.name, size: entry.defaultSize });
    }
  }

  return (
    <div className="absolute top-14 right-4 flex flex-col gap-3 z-[5]">
      {/* App icons */}
      {DESKTOP_ICONS.map((item) => (
        <button
          key={item.id}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-white/8 w-[72px] cursor-pointer group"
          onClick={(e) => { e.stopPropagation(); handleIconClick(item.id); }}
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
          <span className="text-[9px] text-center leading-tight opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--os-text)' }}>
            {item.label}
          </span>
        </button>
      ))}

      {/* Pinned Agents divider + icons */}
      {pinnedAgents.length > 0 && (
        <>
          <div className="w-10 mx-auto h-px" style={{ background: 'rgba(0, 229, 204, 0.15)' }} />
          {pinnedAgents.map((agent) => (
            <button
              key={agent.name}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-white/8 w-[72px] cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                const entry = registry.find(a => a.id === 'terminal');
                launchApp('terminal', {
                  title: `Agent: ${agent.name}`,
                  size: entry?.defaultSize,
                  data: { agentName: agent.name },
                });
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all group-hover:scale-105"
                style={{ background: 'rgba(0, 229, 204, 0.06)', border: '1px solid rgba(0, 229, 204, 0.15)' }}
              >
                {agent.icon}
              </div>
              <span className="text-[9px] text-center leading-tight truncate w-full opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--os-text)' }}>
                {agent.name}
              </span>
            </button>
          ))}
        </>
      )}
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
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--os-accent)', borderTopColor: 'transparent' }}
            />
            <span className="text-[11px] tracking-wide">Initializing...</span>
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
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'var(--os-desktop)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          useAppStore.setState({ foregroundInstanceId: null });
        }
      }}
    >
      {/* Spatial Desktop wallpaper */}
      <div className="absolute inset-0 pointer-events-none desktop-bg" />

      <MenuBar />

      {/* Desktop icons (pinned agents) */}
      <DesktopIcons />

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
      <GestorChat />
    </div>
  );
}
