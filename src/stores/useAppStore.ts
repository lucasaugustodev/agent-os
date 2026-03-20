import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppId, AppInstance, Position, Size, Rect } from '../types/os';

function uid(): string {
  // crypto.randomUUID() requires secure context (HTTPS), so use fallback
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function cascadePosition(instances: AppInstance[]): Position {
  const base = { x: 80, y: 60 };
  const offset = (instances.length % 8) * 30;
  return { x: base.x + offset, y: base.y + offset };
}

interface PinnedAgent {
  name: string;
  icon: string;
}

interface AppStoreState {
  instances: AppInstance[];
  instanceOrder: string[];
  foregroundInstanceId: string | null;
  pinnedAgents: PinnedAgent[];

  launchApp: (appId: AppId, opts?: {
    title?: string;
    size?: Size;
    launchOrigin?: Rect;
    data?: unknown;
  }) => string;
  closeInstance: (instanceId: string) => void;
  minimizeInstance: (instanceId: string) => void;
  restoreInstance: (instanceId: string) => void;
  toggleMaximize: (instanceId: string) => void;
  bringToForeground: (instanceId: string) => void;
  updatePosition: (instanceId: string, pos: Position) => void;
  updateSize: (instanceId: string, size: Size) => void;
  getInstancesByApp: (appId: AppId) => AppInstance[];
  pinAgent: (name: string, icon: string) => void;
  unpinAgent: (name: string) => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      instances: [],
      instanceOrder: [],
      foregroundInstanceId: null,
      pinnedAgents: [],

      launchApp: (appId, opts) => {
        const id = uid();
        const pos = cascadePosition(get().instances);
        const instance: AppInstance = {
          instanceId: id,
          appId,
          title: opts?.title ?? appId,
          position: pos,
          size: opts?.size ?? { width: 800, height: 500 },
          isMinimized: false,
          isMaximized: false,
          createdAt: Date.now(),
          launchOrigin: opts?.launchOrigin,
          data: opts?.data,
        };
        set((s) => ({
          instances: [...s.instances, instance],
          instanceOrder: [...s.instanceOrder, id],
          foregroundInstanceId: id,
        }));
        return id;
      },

      closeInstance: (instanceId) => {
        set((s) => {
          const newInstances = s.instances.filter((i) => i.instanceId !== instanceId);
          const newOrder = s.instanceOrder.filter((id) => id !== instanceId);
          const newFg =
            s.foregroundInstanceId === instanceId
              ? newOrder.findLast((id) =>
                  newInstances.find((i) => i.instanceId === id && !i.isMinimized)
                ) ?? null
              : s.foregroundInstanceId;
          return {
            instances: newInstances,
            instanceOrder: newOrder,
            foregroundInstanceId: newFg,
          };
        });
      },

      minimizeInstance: (instanceId) => {
        set((s) => {
          const instances = s.instances.map((i) =>
            i.instanceId === instanceId ? { ...i, isMinimized: true } : i
          );
          const newFg =
            s.foregroundInstanceId === instanceId
              ? s.instanceOrder.findLast((id) =>
                  instances.find((i) => i.instanceId === id && !i.isMinimized && id !== instanceId)
                ) ?? null
              : s.foregroundInstanceId;
          return { instances, foregroundInstanceId: newFg };
        });
      },

      restoreInstance: (instanceId) => {
        set((s) => ({
          instances: s.instances.map((i) =>
            i.instanceId === instanceId ? { ...i, isMinimized: false } : i
          ),
          instanceOrder: [
            ...s.instanceOrder.filter((id) => id !== instanceId),
            instanceId,
          ],
          foregroundInstanceId: instanceId,
        }));
      },

      toggleMaximize: (instanceId) => {
        set((s) => ({
          instances: s.instances.map((i) => {
            if (i.instanceId !== instanceId) return i;
            if (i.isMaximized) {
              return {
                ...i,
                isMaximized: false,
                position: i.preMaximizeRect ?? i.position,
                size: i.preMaximizeRect
                  ? { width: i.preMaximizeRect.width, height: i.preMaximizeRect.height }
                  : i.size,
                preMaximizeRect: undefined,
              };
            }
            return {
              ...i,
              isMaximized: true,
              preMaximizeRect: { ...i.position, ...i.size },
              position: { x: 0, y: 36 },
              size: { width: window.innerWidth, height: window.innerHeight - 36 - 60 },
            };
          }),
        }));
      },

      bringToForeground: (instanceId) => {
        set((s) => ({
          instanceOrder: [
            ...s.instanceOrder.filter((id) => id !== instanceId),
            instanceId,
          ],
          foregroundInstanceId: instanceId,
        }));
      },

      updatePosition: (instanceId, pos) => {
        set((s) => ({
          instances: s.instances.map((i) =>
            i.instanceId === instanceId ? { ...i, position: pos } : i
          ),
        }));
      },

      updateSize: (instanceId, size) => {
        set((s) => ({
          instances: s.instances.map((i) =>
            i.instanceId === instanceId ? { ...i, size } : i
          ),
        }));
      },

      getInstancesByApp: (appId) => {
        return get().instances.filter((i) => i.appId === appId);
      },

      pinAgent: (name, icon) => {
        set((s) => {
          if (s.pinnedAgents.some((a) => a.name === name)) return s;
          return { pinnedAgents: [...s.pinnedAgents, { name, icon }] };
        });
      },

      unpinAgent: (name) => {
        set((s) => ({
          pinnedAgents: s.pinnedAgents.filter((a) => a.name !== name),
        }));
      },
    }),
    {
      name: 'agentos:app-store',
      partialize: (state) => ({
        instances: state.instances.map(({ launchOrigin, ...rest }) => rest),
        instanceOrder: state.instanceOrder,
        pinnedAgents: state.pinnedAgents,
      }),
    }
  )
);
