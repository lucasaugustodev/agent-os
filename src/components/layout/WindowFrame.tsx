import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Square, Copy } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useWindowDrag } from '../../hooks/useWindowDrag';
import { useWindowResize, type Edge } from '../../hooks/useWindowResize';
import type { AppId, Size } from '../../types/os';

interface WindowFrameProps {
  instanceId: string;
  appId: AppId;
  title: string;
  children: React.ReactNode;
  isForeground: boolean;
  minSize?: Size;
  icon?: React.ReactNode;
}

const RESIZE_EDGES: { edge: Edge; className: string; cursor: string }[] = [
  { edge: 'n', className: 'top-0 left-2 right-2 h-1', cursor: 'ns-resize' },
  { edge: 's', className: 'bottom-0 left-2 right-2 h-1', cursor: 'ns-resize' },
  { edge: 'e', className: 'right-0 top-2 bottom-2 w-1', cursor: 'ew-resize' },
  { edge: 'w', className: 'left-0 top-2 bottom-2 w-1', cursor: 'ew-resize' },
  { edge: 'ne', className: 'top-0 right-0 w-3 h-3', cursor: 'nesw-resize' },
  { edge: 'nw', className: 'top-0 left-0 w-3 h-3', cursor: 'nwse-resize' },
  { edge: 'se', className: 'bottom-0 right-0 w-3 h-3', cursor: 'nwse-resize' },
  { edge: 'sw', className: 'bottom-0 left-0 w-3 h-3', cursor: 'nesw-resize' },
];

export function WindowFrame({
  instanceId,
  appId: _appId,
  title,
  children,
  isForeground,
  minSize,
  icon,
}: WindowFrameProps) {
  const instance = useAppStore((s) => s.instances.find((i) => i.instanceId === instanceId));
  const closeInstance = useAppStore((s) => s.closeInstance);
  const minimizeInstance = useAppStore((s) => s.minimizeInstance);
  const toggleMaximize = useAppStore((s) => s.toggleMaximize);
  const bringToForeground = useAppStore((s) => s.bringToForeground);
  const updatePosition = useAppStore((s) => s.updatePosition);
  const updateSize = useAppStore((s) => s.updateSize);

  const { handlePointerDown } = useWindowDrag({
    onDragStart: () => bringToForeground(instanceId),
    onDrag: (pos) => updatePosition(instanceId, pos),
  });

  const { startResize } = useWindowResize({
    position: instance?.position ?? { x: 0, y: 0 },
    size: instance?.size ?? { width: 800, height: 500 },
    minSize,
    onResize: (pos, size) => {
      updatePosition(instanceId, pos);
      updateSize(instanceId, size);
    },
  });

  if (!instance || instance.isMinimized) return null;

  const zIndex = useAppStore.getState().instanceOrder.indexOf(instanceId) + 10;

  return (
    <AnimatePresence>
      <motion.div
        data-window
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="absolute"
        style={{
          left: instance.position.x,
          top: instance.position.y,
          width: instance.size.width,
          height: instance.size.height,
          zIndex,
        }}
        onPointerDown={() => {
          if (!isForeground) bringToForeground(instanceId);
        }}
      >
        {/* Window chrome */}
        <div
          className="flex flex-col h-full rounded-lg overflow-hidden"
          style={{
            background: 'var(--os-window-bg)',
            border: `1px solid ${isForeground ? 'var(--os-accent)' : 'var(--os-window-border)'}`,
            boxShadow: isForeground
              ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(137,180,250,0.15)'
              : '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center h-9 px-3 gap-2 shrink-0 select-none"
            style={{ background: 'var(--os-titlebar)' }}
            onPointerDown={handlePointerDown}
            onDoubleClick={() => toggleMaximize(instanceId)}
          >
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                className="w-3 h-3 rounded-full flex items-center justify-center transition-colors group"
                style={{ background: 'var(--os-red)' }}
                onClick={(e) => { e.stopPropagation(); closeInstance(instanceId); }}
                title="Close"
              >
                <X size={8} className="opacity-0 group-hover:opacity-100 text-black/80" />
              </button>
              <button
                className="w-3 h-3 rounded-full flex items-center justify-center transition-colors group"
                style={{ background: 'var(--os-yellow)' }}
                onClick={(e) => { e.stopPropagation(); minimizeInstance(instanceId); }}
                title="Minimize"
              >
                <Minus size={8} className="opacity-0 group-hover:opacity-100 text-black/80" />
              </button>
              <button
                className="w-3 h-3 rounded-full flex items-center justify-center transition-colors group"
                style={{ background: 'var(--os-green)' }}
                onClick={(e) => { e.stopPropagation(); toggleMaximize(instanceId); }}
                title="Maximize"
              >
                {instance.isMaximized
                  ? <Copy size={7} className="opacity-0 group-hover:opacity-100 text-black/80" />
                  : <Square size={7} className="opacity-0 group-hover:opacity-100 text-black/80" />
                }
              </button>
            </div>

            {/* Title */}
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              {icon}
              <span
                className="text-xs font-medium truncate"
                style={{ color: isForeground ? 'var(--os-titlebar-text)' : 'var(--os-titlebar-inactive)' }}
              >
                {title}
              </span>
            </div>

            {/* Spacer to balance traffic lights */}
            <div className="w-[52px] shrink-0" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>

        {/* Resize handles */}
        {!instance.isMaximized &&
          RESIZE_EDGES.map(({ edge, className, cursor }) => (
            <div
              key={edge}
              className={`absolute ${className}`}
              style={{ cursor, zIndex: 1 }}
              onPointerDown={(e) => startResize(e, edge)}
            />
          ))}
      </motion.div>
    </AnimatePresence>
  );
}
