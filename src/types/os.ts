export type AppId = string;

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

export interface AppInstance {
  instanceId: string;
  appId: AppId;
  title: string;
  position: Position;
  size: Size;
  isMinimized: boolean;
  isMaximized: boolean;
  preMaximizeRect?: Rect;
  createdAt: number;
  launchOrigin?: Rect;
  data?: unknown;
}

export interface AppComponentProps {
  instanceId: string;
  appId: AppId;
  data?: unknown;
}

export interface AppRegistryEntry {
  id: AppId;
  name: string;
  icon: string;
  description: string;
  component: React.LazyExoticComponent<React.ComponentType<AppComponentProps>>;
  defaultSize: Size;
  minSize?: Size;
  allowMultiple?: boolean;
  dockPinned?: boolean;
}
