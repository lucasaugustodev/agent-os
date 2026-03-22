import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';

// Emoji map for dock icons matching the old design
const DOCK_EMOJI: Record<string, string> = {
  globe: '◎',
  terminal: '>',
  messageSquare: '💬',
  inbox: '📋',
  brain: '🧠',
  layoutDashboard: '🔀',
  bot: '🤖',
  folderOpen: '📁',
  activity: '⚡',
  gitBranch: '⌥',
  database: '◆',
  container: '🐳',
  settings: '⚙',
};

function getEmoji(iconName: string): string {
  return DOCK_EMOJI[iconName] ?? iconName.charAt(0).toUpperCase();
}

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
      launchApp(appId, { title: entry?.name ?? appId, size: entry?.defaultSize });
      return;
    }
    const minimized = appInstances.find((i) => i.isMinimized);
    if (minimized) {
      restoreInstance(minimized.instanceId);
      return;
    }
    const topInstance = appInstances[appInstances.length - 1];
    if (topInstance) {
      bringToForeground(topInstance.instanceId);
    }
  }

  const nonPinnedRunning = [...runningAppIds].filter((id) => !pinnedApps.find((p) => p.id === id));

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-2xl z-[1000]"
      style={{
        background: 'rgba(10, 16, 28, 0.70)',
        backdropFilter: 'blur(48px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Synthesize Agent button */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl mr-1 cursor-pointer"
        style={{ background: 'var(--os-accent)', color: '#0a0e17' }}
        onClick={() => {
          const entry = registry.find((a) => a.id === 'agents');
          launchApp('agents', { title: 'Agent Manager', size: entry?.defaultSize, data: { view: 'create' } });
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Synthesize Agent</span>
      </motion.button>

      {/* Separator */}
      <div className="w-px h-7 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {pinnedApps.map((app) => {
        const isRunning = runningAppIds.has(app.id);
        const isFocused = instances.some(
          (i) => i.appId === app.id && i.instanceId === foregroundInstanceId
        );
        const emoji = getEmoji(app.icon);

        return (
          <motion.button
            key={app.id}
            whileHover={{ scale: 1.1, y: -3 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl cursor-pointer relative"
            style={{ color: isFocused ? 'var(--os-accent)' : 'var(--os-text-muted)' }}
            onClick={() => handleDockClick(app.id)}
            title={app.name}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl text-base transition-all"
              style={{
                background: isFocused
                  ? 'rgba(0, 229, 204, 0.12)'
                  : 'rgba(255,255,255,0.04)',
                border: isFocused
                  ? '1px solid rgba(0, 229, 204, 0.2)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {emoji}
            </div>
            {/* Running dot */}
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

      {/* Separator for non-pinned running apps */}
      {nonPinnedRunning.length > 0 && (
        <div
          className="w-px h-7 mx-1"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />
      )}

      {/* Non-pinned running apps */}
      {nonPinnedRunning.map((appId) => {
        const entry = registry.find((a) => a.id === appId);
        const isFocused = instances.some(
          (i) => i.appId === appId && i.instanceId === foregroundInstanceId
        );
        const emoji = getEmoji(entry?.icon ?? 'appWindow');

        return (
          <motion.button
            key={appId}
            whileHover={{ scale: 1.1, y: -3 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl cursor-pointer"
            style={{ color: isFocused ? 'var(--os-accent)' : 'var(--os-text-muted)' }}
            onClick={() => handleDockClick(appId)}
            title={entry?.name ?? appId}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl text-base"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {emoji}
            </div>
            <div className="w-1 h-1 rounded-full" style={{ background: 'var(--os-accent)' }} />
          </motion.button>
        );
      })}
    </motion.div>
  );
}
