import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';

export function Dock() {
  const instances = useAppStore((s) => s.instances);
  const foregroundInstanceId = useAppStore((s) => s.foregroundInstanceId);
  const launchApp = useAppStore((s) => s.launchApp);
  const restoreInstance = useAppStore((s) => s.restoreInstance);
  const bringToForeground = useAppStore((s) => s.bringToForeground);

  const registry = getRegistry();
  const pinnedApps = registry.filter((app) => app.dockPinned);
  const runningAppIds = new Set(instances.map((i) => i.appId));

  function handleDockClick(appId: string) {
    const appInstances = instances.filter((i) => i.appId === appId);
    if (appInstances.length === 0) {
      const entry = registry.find((a) => a.id === appId);
      launchApp(appId, {
        title: entry?.name ?? appId,
        size: entry?.defaultSize,
      });
      return;
    }
    // If there's a minimized instance, restore it
    const minimized = appInstances.find((i) => i.isMinimized);
    if (minimized) {
      restoreInstance(minimized.instanceId);
      return;
    }
    // Bring the most recent to foreground
    const topInstance = appInstances[appInstances.length - 1];
    if (topInstance) {
      bringToForeground(topInstance.instanceId);
    }
  }

  function getIcon(iconName: string) {
    const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[
      iconName.charAt(0).toUpperCase() + iconName.slice(1)
    ] ?? Icons.AppWindow;
    return <Icon size={22} />;
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1 px-3 py-1.5 rounded-2xl z-[1000]"
      style={{
        background: 'var(--os-dock)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {pinnedApps.map((app) => {
        const isRunning = runningAppIds.has(app.id);
        const isFocused = instances.some(
          (i) => i.appId === app.id && i.instanceId === foregroundInstanceId
        );

        return (
          <motion.button
            key={app.id}
            whileHover={{ scale: 1.15, y: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-colors"
            style={{
              color: isFocused ? 'var(--os-accent)' : 'var(--os-text-muted)',
            }}
            onClick={() => handleDockClick(app.id)}
            title={app.name}
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{
                background: isFocused
                  ? 'rgba(137,180,250,0.12)'
                  : 'rgba(255,255,255,0.04)',
              }}
            >
              {getIcon(app.icon)}
            </div>
            {/* Running indicator */}
            <div
              className="w-1 h-1 rounded-full transition-opacity"
              style={{
                background: 'var(--os-accent)',
                opacity: isRunning ? 1 : 0,
              }}
            />
          </motion.button>
        );
      })}

      {/* Separator if there are running non-pinned apps */}
      {instances.some((i) => !pinnedApps.find((p) => p.id === i.appId)) && (
        <div className="w-px h-8 mx-1" style={{ background: 'var(--os-surface)' }} />
      )}

      {/* Running non-pinned apps */}
      {[...runningAppIds]
        .filter((id) => !pinnedApps.find((p) => p.id === id))
        .map((appId) => {
          const entry = registry.find((a) => a.id === appId);
          const isFocused = instances.some(
            (i) => i.appId === appId && i.instanceId === foregroundInstanceId
          );
          return (
            <motion.button
              key={appId}
              whileHover={{ scale: 1.15, y: -4 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl"
              style={{
                color: isFocused ? 'var(--os-accent)' : 'var(--os-text-muted)',
              }}
              onClick={() => handleDockClick(appId)}
              title={entry?.name ?? appId}
            >
              <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {getIcon(entry?.icon ?? 'appWindow')}
              </div>
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--os-accent)' }} />
            </motion.button>
          );
        })}
    </motion.div>
  );
}
