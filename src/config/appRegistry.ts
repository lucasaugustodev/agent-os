import { lazy } from 'react';
import type { AppRegistryEntry } from '../types/os';

const Placeholder = lazy(() => import('../apps/Placeholder'));
const BrowserApp = lazy(() => import('../apps/Browser'));

const registry: AppRegistryEntry[] = [
  {
    id: 'browser',
    name: 'Browser',
    icon: 'globe',
    description: 'Web browser powered by Chromium',
    component: BrowserApp,
    defaultSize: { width: 1024, height: 640 },
    minSize: { width: 600, height: 400 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: 'terminal',
    description: 'Agent terminal session',
    component: Placeholder,
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 400, height: 300 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'inbox',
    name: 'Inbox',
    icon: 'inbox',
    description: 'Agent task inbox with threaded comments',
    component: Placeholder,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 400 },
    dockPinned: true,
  },
  {
    id: 'mission-control',
    name: 'Mission Control',
    icon: 'layoutDashboard',
    description: 'Kanban board for agent tasks',
    component: Placeholder,
    defaultSize: { width: 1000, height: 650 },
    minSize: { width: 600, height: 400 },
    dockPinned: true,
  },
  {
    id: 'agents',
    name: 'Agents',
    icon: 'bot',
    description: 'Agent org chart and management',
    component: Placeholder,
    defaultSize: { width: 850, height: 550 },
    minSize: { width: 400, height: 300 },
    dockPinned: true,
  },
  {
    id: 'finder',
    name: 'Finder',
    icon: 'folderOpen',
    description: 'Browse agent workspaces and deliverables',
    component: Placeholder,
    defaultSize: { width: 800, height: 500 },
    minSize: { width: 400, height: 300 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    description: 'System and agent configuration',
    component: Placeholder,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    dockPinned: true,
  },
];

export function getRegistry(): AppRegistryEntry[] {
  return registry;
}

export function getRegistryEntry(appId: string): AppRegistryEntry | undefined {
  return registry.find((e) => e.id === appId);
}
