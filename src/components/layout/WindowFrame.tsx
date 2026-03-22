import { AnimatePresence, motion } from 'framer-motion';
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
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
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
        {/* Window chrome with glass effect */}
        <div
          className={`flex flex-col h-full rounded-2xl overflow-hidden glass-window ${
            isForeground ? 'glass-window-active' : 'glass-window-inactive'
          }`}
        >
          {/* Title bar */}
          <div
            className="flex items-center h-10 px-4 gap-3 shrink-0 select-none"
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={() => toggleMaximize(instanceId)}
          >
            {/* Title left side: optional icon + title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {icon}
              <span
                className="text-xs font-medium tracking-wide truncate"
                style={{
                  color: isForeground ? 'var(--os-text)' : 'var(--os-text-muted)',
                }}
              >
                {title}
              </span>
            </div>

            {/* Traffic light buttons - right side */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Minimize */}
              <button
                className="w-3 h-3 rounded-full transition-all hover:scale-110 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  minimizeInstance(instanceId);
                }}
                title="Minimize"
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'var(--os-yellow)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                }}
              />
              {/* Close */}
              <button
                className="w-3 h-3 rounded-full transition-all hover:scale-110 cursor-pointer flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeInstance(instanceId);
                }}
                title="Close"
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'var(--os-red)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                }}
              >
                <svg
                  width="7"
                  height="7"
                  viewBox="0 0 7 7"
                  className="opacity-0 hover:opacity-100 pointer-events-none"
                  style={{ color: '#fff' }}
                >
                  <line x1="1" y1="1" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="6" y1="1" x2="1" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content area */}
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
