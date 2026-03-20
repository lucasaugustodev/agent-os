import { lazy } from 'react';
import type { AppRegistryEntry } from '../types/os';

const Placeholder = lazy(() => import('../apps/Placeholder'));
const BrowserApp = lazy(() => import('../apps/Browser'));
const TerminalApp = lazy(() => import('../apps/Terminal'));
const AgentsApp = lazy(() => import('../apps/Agents'));
const SmolChatApp = lazy(() => import('../apps/SmolChat'));
const FileExplorerApp = lazy(() => import('../apps/FileExplorer'));
const PM2ManagerApp = lazy(() => import('../apps/PM2Manager'));
const GitHubCLIApp = lazy(() => import('../apps/GitHubCLI'));
const SupabaseApp = lazy(() => import('../apps/Supabase'));

const registry: AppRegistryEntry[] = [
  {
    id: 'agents',
    name: 'Fleet Monitor',
    icon: 'grid3x3',
    description: 'Monitor active agents and fleet status',
    component: AgentsApp,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 350 },
    dockPinned: true,
  },
  {
    id: 'terminal',
    name: 'Neural Terminal',
    icon: 'terminal',
    description: 'Agent terminal with live logs',
    component: TerminalApp,
    defaultSize: { width: 900, height: 560 },
    minSize: { width: 400, height: 300 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'finder',
    name: 'Virtual Filesystem',
    icon: 'folderOpen',
    description: 'Browse agent workspaces and data',
    component: FileExplorerApp,
    defaultSize: { width: 900, height: 550 },
    minSize: { width: 500, height: 350 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'pm2',
    name: 'PM2 Manager',
    icon: 'activity',
    description: 'Manage PM2 processes',
    component: PM2ManagerApp,
    defaultSize: { width: 850, height: 500 },
    minSize: { width: 500, height: 300 },
    dockPinned: true,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: 'database',
    description: 'Manage Supabase projects, tables, SQL',
    component: SupabaseApp,
    defaultSize: { width: 950, height: 600 },
    minSize: { width: 500, height: 350 },
    dockPinned: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'gitBranch',
    description: 'GitHub repos, issues, PRs and notifications',
    component: GitHubCLIApp,
    defaultSize: { width: 900, height: 550 },
    minSize: { width: 500, height: 350 },
    dockPinned: false,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    description: 'System configuration',
    component: Placeholder,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    dockPinned: false,
  },
  {
    id: 'smol',
    name: 'SmolAgent',
    icon: 'brain',
    description: 'Local AI agent powered by Qwen 3B + llama.cpp',
    component: SmolChatApp,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    dockPinned: false,
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: 'container',
    description: 'Manage Docker containers and images',
    component: Placeholder,
    defaultSize: { width: 850, height: 550 },
    minSize: { width: 450, height: 300 },
    dockPinned: false,
  },
  {
    id: 'browser',
    name: 'Browser',
    icon: 'globe',
    description: 'Web browser powered by Chromium',
    component: BrowserApp,
    defaultSize: { width: 1024, height: 640 },
    minSize: { width: 600, height: 400 },
    allowMultiple: true,
    dockPinned: false,
  },
];

export function getRegistry(): AppRegistryEntry[] {
  return registry;
}

export function getRegistryEntry(appId: string): AppRegistryEntry | undefined {
  return registry.find((e) => e.id === appId);
}
