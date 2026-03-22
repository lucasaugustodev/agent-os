import { motion } from 'framer-motion';
import {
  Grid3x3,
  Terminal,
  Globe,
  FolderOpen,
  Activity,
  Settings,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';

const DOCK_APPS = [
  { id: 'agents', icon: Grid3x3, label: 'Fleet' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'browser', icon: Globe, label: 'Browser' },
  { id: 'file-explorer', icon: FolderOpen, label: 'Files' },
  { id: 'pm2-manager', icon: Activity, label: 'PM2' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Dock() {
  const instances = useAppStore((s) => s.instances);
  const foregroundInstanceId = useAppStore((s) => s.foregroundInstanceId);
  const launchApp = useAppStore((s) => s.launchApp);
  const restoreInstance = useAppStore((s) => s.restoreInstance);
  const bringToForeground = useAppStore((s) => s.bringToForeground);

  const registry = getRegistry();
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

  function handleSynthesize() {
    const entry = registry.find((a) => a.id === 'agents');
    launchApp('agents', {
      title: 'Synthesize Agent',
      size: entry?.defaultSize,
      data: { view: 'create' },
    });
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-2xl z-[1000]"
      style={{
        background: 'rgba(10, 16, 28, 0.7)',
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
        onClick={handleSynthesize}
      >
        <Zap size={15} strokeWidth={2.5} />
        <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Synthesize Agent</span>
      </motion.button>

      {/* Separator */}
      <div className="w-px h-7 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {DOCK_APPS.map((app) => {
        const isRunning = runningAppIds.has(app.id);
        const isFocused = instances.some(
          (i) => i.appId === app.id && i.instanceId === foregroundInstanceId
        );
        const Icon = app.icon;

        return (
          <motion.button
            key={app.id}
            whileHover={{ scale: 1.12, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="relative flex flex-col items-center p-2 rounded-xl cursor-pointer"
            style={{ color: isFocused ? 'var(--os-accent)' : 'var(--os-text-muted)' }}
            onClick={() => handleDockClick(app.id)}
            title={app.label}
          >
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              style={{
                background: isFocused ? 'rgba(0, 229, 204, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <Icon size={20} />
            </div>
            <div
              className="absolute -bottom-0.5 w-1 h-1 rounded-full transition-opacity"
              style={{
                background: 'var(--os-accent)',
                opacity: isRunning ? 1 : 0,
              }}
            />
          </motion.button>
        );
      })}
    </motion.div>
  );
}
