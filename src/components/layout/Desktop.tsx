import { Suspense } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';
import { WindowFrame } from './WindowFrame';
import { Dock } from './Dock';
import { MenuBar } from './MenuBar';
import type { AppComponentProps } from '../../types/os';

function DesktopIcons() {
  const launchApp = useAppStore((s) => s.launchApp);
  const registry = getRegistry();
  const pinnedApps = registry.filter((app) => app.dockPinned);

  return (
    <div className="absolute top-12 right-4 flex flex-col gap-3 z-[5]">
      {pinnedApps.map((app) => (
        <button
          key={app.id}
          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-white/10 w-20 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            launchApp(app.id, { title: app.name, size: app.defaultSize });
          }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <span className="text-2xl" style={{ color: 'var(--os-accent)' }}>
              {app.icon === 'terminal' ? '>' :
               app.icon === 'inbox' ? '\u2709' :
               app.icon === 'layoutDashboard' ? '\u25A6' :
               app.icon === 'bot' ? '\u2699' :
               app.icon === 'folderOpen' ? '\u{1F4C1}' :
               app.icon === 'settings' ? '\u2699' :
               app.icon.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--os-text)' }}>
            {app.name}
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
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: 'var(--os-desktop)' }}
      onMouseDown={(e) => {
        // Only clear foreground when clicking the actual desktop background
        if (e.target === e.currentTarget) {
          useAppStore.setState({ foregroundInstanceId: null });
        }
      }}
    >
      {/* Background pattern - pointer-events-none so it doesn't block clicks */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, var(--os-text) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <MenuBar />

      {/* Desktop icons */}
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
    </div>
  );
}
