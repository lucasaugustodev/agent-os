import { lazy } from 'react';
import type { AppRegistryEntry } from '../types/os';

const Placeholder = lazy(() => import('../apps/Placeholder'));
const BrowserApp = lazy(() => import('../apps/Browser'));
const TerminalApp = lazy(() => import('../apps/Terminal'));
const SmolChatApp = lazy(() => import('../apps/SmolChat'));
const ThreadsApp = lazy(() => import('../apps/Threads'));
const KnowledgeApp = lazy(() => import('../apps/Knowledge'));
const FlowsApp = lazy(() => import('../apps/Flows'));
const AgentManagerApp = lazy(() => import('../apps/AgentManager'));
const AgentsApp = lazy(() => import('../apps/Agents'));
const FileExplorerApp = lazy(() => import('../apps/FileExplorer'));
const PM2ManagerApp = lazy(() => import('../apps/PM2Manager'));
const GitHubCLIApp = lazy(() => import('../apps/GitHubCLI'));
const SupabaseApp = lazy(() => import('../apps/Supabase'));
const DockerApp = lazy(() => import('../apps/Docker'));
const SettingsApp = lazy(() => import('../apps/Settings'));

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
    description: 'Terminal via ttyd',
    component: TerminalApp,
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 400, height: 300 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'smol-chat',
    name: 'SmolChat',
    icon: 'messageSquare',
    description: 'Chat com o Agent OS (Llama 70B + Claude)',
    component: SmolChatApp,
    defaultSize: { width: 480, height: 620 },
    minSize: { width: 360, height: 400 },
    allowMultiple: true,
    dockPinned: true,
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: 'inbox',
    description: 'Visualizador de threads de agentes',
    component: ThreadsApp,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 400 },
    dockPinned: true,
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    icon: 'brain',
    description: 'Base de conhecimento e memória',
    component: KnowledgeApp,
    defaultSize: { width: 800, height: 580 },
    minSize: { width: 500, height: 400 },
    dockPinned: true,
  },
  {
    id: 'flows',
    name: 'Flows',
    icon: 'layoutDashboard',
    description: 'Kanban board de flows de agentes',
    component: FlowsApp,
    defaultSize: { width: 1100, height: 650 },
    minSize: { width: 700, height: 400 },
    dockPinned: true,
  },
  {
    id: 'agent-manager',
    name: 'Agent Manager',
    icon: 'bot',
    description: 'Criação e gerenciamento de agentes',
    component: AgentManagerApp,
    defaultSize: { width: 860, height: 580 },
    minSize: { width: 500, height: 400 },
    dockPinned: true,
  },
  {
    id: 'agents',
    name: 'Agents',
    icon: 'bot',
    description: 'Agent org chart and management',
    component: AgentsApp,
    defaultSize: { width: 860, height: 580 },
    minSize: { width: 500, height: 400 },
    dockPinned: false,
  },
  {
    id: 'file-explorer',
    name: 'File Explorer',
    icon: 'folderOpen',
    description: 'Navegador de arquivos do sistema',
    component: FileExplorerApp,
    defaultSize: { width: 800, height: 500 },
    minSize: { width: 400, height: 300 },
    allowMultiple: true,
    dockPinned: false,
  },
  {
    id: 'pm2-manager',
    name: 'PM2 Manager',
    icon: 'activity',
    description: 'Gerenciamento de processos PM2',
    component: PM2ManagerApp,
    defaultSize: { width: 800, height: 520 },
    minSize: { width: 500, height: 350 },
    dockPinned: false,
  },
  {
    id: 'github-cli',
    name: 'GitHub CLI',
    icon: 'gitBranch',
    description: 'Interface GitHub CLI',
    component: GitHubCLIApp,
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 400, height: 300 },
    dockPinned: false,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: 'database',
    description: 'Gerenciamento Supabase',
    component: SupabaseApp,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 400 },
    dockPinned: false,
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: 'container',
    description: 'Gerenciamento de containers Docker',
    component: DockerApp,
    defaultSize: { width: 860, height: 560 },
    minSize: { width: 500, height: 350 },
    dockPinned: false,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    description: 'Configurações do Agent OS',
    component: SettingsApp,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    dockPinned: false,
  },
  {
    id: 'inbox',
    name: 'Inbox',
    icon: 'inbox',
    description: 'Agent task inbox',
    component: Placeholder,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 500, height: 400 },
    dockPinned: false,
  },
  {
    id: 'mission-control',
    name: 'Mission Control',
    icon: 'layoutDashboard',
    description: 'Painel central de controle',
    component: Placeholder,
    defaultSize: { width: 1000, height: 650 },
    minSize: { width: 600, height: 400 },
    dockPinned: false,
  },
];

export function getRegistry(): AppRegistryEntry[] {
  return registry;
}

export function getRegistryEntry(appId: string): AppRegistryEntry | undefined {
  return registry.find((e) => e.id === appId);
}
