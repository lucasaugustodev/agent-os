import { useEffect, useState } from 'react';
import {
  Bot, Plus, Download, ChevronRight, Sparkles,
  Terminal as TermIcon, Globe2, Cpu, ArrowLeft,
  Check, Loader2, Package, Zap, Shield, Code2,
  LayoutGrid, Search
} from 'lucide-react';
import type { AppComponentProps } from '../../types/os';
import { useAppStore } from '../../stores/useAppStore';
import { getRegistry } from '../../config/appRegistry';

const API = '/api/launcher';

interface Agent {
  name: string;
  filename: string;
  model?: string;
  color?: string;
  description?: string;
  installed?: boolean;
}

interface MarketplaceAgent {
  filename: string;
  name: string;
  model?: string;
  color?: string;
  description?: string;
  installed: boolean;
}

interface AgentPack {
  id: string;
  name: string;
  description: string;
  agents: MarketplaceAgent[];
  cached: boolean;
}

type View = 'home' | 'library' | 'create' | 'detail';
type CreateStep = 'type' | 'config' | 'confirm';
type CLIType = 'claude' | 'gemini' | 'codex';

const CLI_OPTIONS: { id: CLIType; name: string; desc: string; icon: typeof Cpu }[] = [
  { id: 'claude', name: 'Claude Code', desc: 'Anthropic CLI - coding, debugging, deployment', icon: Cpu },
  { id: 'gemini', name: 'Gemini CLI', desc: 'Google CLI - research, analysis, code generation', icon: Globe2 },
  { id: 'codex', name: 'Codex CLI', desc: 'OpenAI CLI - code generation, refactoring', icon: Code2 },
];

const AGENT_ICONS: Record<string, string> = {
  'manager-agent': '\u{1F4CB}',
  'implementation-agent': '\u{1F528}',
  'project-discovery': '\u{1F50D}',
  'pm-agent': '\u{1F4CA}',
  'cicd-deployer': '\u{1F680}',
  'live-node': '\u{26A1}',
  'file-guardian': '\u{1F6E1}',
  'playwright-test-runner': '\u{1F3AD}',
  'cline-executor': '\u{2699}',
  'windows-automation': '\u{1F5A5}',
  'agentes-documentador': '\u{1F4DD}',
  'ce-test-runner': '\u{2705}',
  'manager-gestor': '\u{1F464}',
};

const AGENT_COLORS: Record<string, string> = {
  'manager-agent': '#cba6f7',
  'implementation-agent': '#89b4fa',
  'project-discovery': '#f9e2af',
  'pm-agent': '#a6e3a1',
  'cicd-deployer': '#fab387',
  'live-node': '#f38ba8',
  'file-guardian': '#f38ba8',
  'playwright-test-runner': '#94e2d5',
  'cline-executor': '#89b4fa',
  'windows-automation': '#cba6f7',
};

function getAgentIcon(name: string) {
  return AGENT_ICONS[name] || '\u{1F916}';
}

function getAgentColor(name: string) {
  return AGENT_COLORS[name] || '#89b4fa';
}

export default function AgentsApp(_props: AppComponentProps) {
  const [view, setView] = useState<View>('home');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [packs, setPacks] = useState<AgentPack[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create wizard state
  const [createStep, setCreateStep] = useState<CreateStep>('type');
  const [selectedCLI, setSelectedCLI] = useState<CLIType>('claude');
  const [agentName, setAgentName] = useState('');
  const [agentWorkdir, setAgentWorkdir] = useState('/home/claude/workspace');
  const [agentMode, setAgentMode] = useState('normal');

  const launchApp = useAppStore((s) => s.launchApp);
  const pinAgent = useAppStore((s) => s.pinAgent);
  const unpinAgent = useAppStore((s) => s.unpinAgent);
  const pinnedAgents = useAppStore((s) => s.pinnedAgents);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const [agentsRes, catalogRes, profilesRes] = await Promise.all([
        fetch(`${API}/claude-agents`).then(r => r.json()),
        fetch(`${API}/marketplace/catalog`).then(r => r.json()),
        fetch(`${API}/profiles`).then(r => r.json()).catch(() => []),
      ]);
      const claudeAgents: Agent[] = (agentsRes.agents || []);
      const claudeAgentNames = new Set(claudeAgents.map((a: Agent) => a.name));

      // Merge profiles that aren't already in claude agents
      const profileAgents: Agent[] = (Array.isArray(profilesRes) ? profilesRes : [])
        .filter((p: { name: string }) => !claudeAgentNames.has(p.name))
        .map((p: { name: string; mode?: string; workingDirectory?: string }) => ({
          name: p.name,
          filename: '',
          description: `Custom agent - ${p.workingDirectory || 'default workspace'}`,
          model: p.mode || 'normal',
          installed: true,
        }));

      setAgents([...claudeAgents, ...profileAgents]);
      setPacks(catalogRes.agentPacks || []);
    } catch {}
    setLoading(false);
  }

  async function installAgent(packId: string, filename: string) {
    setInstalling(filename);
    try {
      await fetch(`${API}/marketplace/install-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, agentNames: [filename] }),
      });
      await loadAgents();
    } catch {}
    setInstalling(null);
  }

  async function installAllAgents(packId: string) {
    setInstalling('all');
    try {
      await fetch(`${API}/marketplace/install-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      await loadAgents();
    } catch {}
    setInstalling(null);
  }

  function launchAgent(agentName: string) {
    // Open a terminal with this agent
    const entry = getRegistry().find(e => e.id === 'terminal');
    launchApp('terminal', {
      title: `Agent: ${agentName}`,
      size: entry?.defaultSize,
      data: { agentName },
    });
  }

  async function createAgent() {
    // Create a profile for this agent
    try {
      await fetch(`${API}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName || 'New Agent',
          workingDirectory: agentWorkdir,
          mode: agentMode,
        }),
      });
      setView('home');
      setCreateStep('type');
      setAgentName('');
      await loadAgents();
    } catch {}
  }

  const filteredAgents = agents.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // === AGENT DETAIL VIEW ===
  if (view === 'detail' && selectedAgent) {
    const isPinned = pinnedAgents.some((a) => a.name === selectedAgent.name);
    return (
      <div className="flex flex-col h-full overflow-auto" style={{ background: '#1e1e2e', color: 'var(--os-text)' }}>
        <div className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
          <button className="p-1.5 rounded hover:bg-white/10" onClick={() => setView('home')}>
            <ArrowLeft size={16} style={{ color: 'var(--os-text-muted)' }} />
          </button>
          <span className="text-sm font-medium">Agent Details</span>
        </div>
        <div className="flex-1 px-8 py-6 overflow-auto">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: `${getAgentColor(selectedAgent.name)}15`, border: `1px solid ${getAgentColor(selectedAgent.name)}30` }}>
              {getAgentIcon(selectedAgent.name)}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{selectedAgent.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                {selectedAgent.model && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--os-surface)', color: 'var(--os-accent)' }}>
                    {selectedAgent.model}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--os-text-muted)' }}>Claude Code Agent</span>
              </div>
            </div>
          </div>

          {selectedAgent.description && (
            <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--os-text-muted)' }}>
              {selectedAgent.description}
            </p>
          )}

          <div className="flex gap-4">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
              onClick={() => launchAgent(selectedAgent.name)}
            >
              <Zap size={14} />
              Launch Agent
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--os-window-border)', color: isPinned ? 'var(--os-accent)' : 'var(--os-text-muted)' }}
              onClick={() => {
                if (isPinned) {
                  unpinAgent(selectedAgent.name);
                } else {
                  pinAgent(selectedAgent.name, getAgentIcon(selectedAgent.name));
                }
              }}
            >
              <LayoutGrid size={14} />
              {isPinned ? 'Unpin from Desktop' : 'Pin to Desktop'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === LIBRARY VIEW ===
  if (view === 'library') {
    return (
      <div className="flex flex-col h-full overflow-auto" style={{ background: '#1e1e2e', color: 'var(--os-text)' }}>
        <div className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
          <button className="p-1.5 rounded hover:bg-white/10" onClick={() => setView('home')}>
            <ArrowLeft size={16} style={{ color: 'var(--os-text-muted)' }} />
          </button>
          <span className="text-sm font-medium">Agent Library</span>
        </div>
        <div className="flex-1 overflow-auto px-8 py-6">
          {packs.map((pack) => (
            <div key={pack.id} className="mb-7">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Package size={14} style={{ color: 'var(--os-accent)' }} />
                    {pack.name}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--os-text-muted)' }}>{pack.description}</p>
                </div>
                <button
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-90 flex items-center gap-1.5"
                  style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
                  onClick={() => installAllAgents(pack.id)}
                  disabled={installing === 'all'}
                >
                  {installing === 'all'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Download size={12} />}
                  Install All
                </button>
              </div>

              {pack.agents.length === 0 && !pack.cached && (
                <div className="text-xs py-4 text-center rounded-lg"
                  style={{ background: 'var(--os-surface)', color: 'var(--os-text-muted)' }}>
                  Click "Install All" to download agents from this pack.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {pack.agents.map((agent) => (
                  <div key={agent.filename}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                    style={{ background: 'var(--os-surface)' }}>
                    <div className="text-xl shrink-0">{getAgentIcon(agent.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{agent.name}</div>
                      {agent.model && (
                        <div className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>{agent.model}</div>
                      )}
                    </div>
                    {agent.installed ? (
                      <Check size={14} style={{ color: 'var(--os-green)' }} />
                    ) : (
                      <button
                        className="p-1 rounded hover:bg-white/10"
                        onClick={() => installAgent(pack.id, agent.filename)}
                        disabled={installing === agent.filename}
                      >
                        {installing === agent.filename
                          ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
                          : <Download size={14} style={{ color: 'var(--os-accent)' }} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === CREATE WIZARD ===
  if (view === 'create') {
    return (
      <div className="flex flex-col h-full" style={{ background: '#1e1e2e', color: 'var(--os-text)' }}>
        <div className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
          <button className="p-1.5 rounded hover:bg-white/10" onClick={() => {
            if (createStep === 'type') setView('home');
            else if (createStep === 'config') setCreateStep('type');
            else setCreateStep('config');
          }}>
            <ArrowLeft size={16} style={{ color: 'var(--os-text-muted)' }} />
          </button>
          <span className="text-sm font-medium">Create Agent</span>
          <div className="flex-1" />
          <div className="flex gap-1">
            {['type', 'config', 'confirm'].map((s, i) => (
              <div key={s} className="w-8 h-1 rounded-full"
                style={{ background: i <= ['type', 'config', 'confirm'].indexOf(createStep)
                  ? 'var(--os-accent)' : 'var(--os-surface)' }} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Step 1: Choose CLI */}
          {createStep === 'type' && (
            <div>
              <h2 className="text-base font-semibold mb-1.5">Choose your engine</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--os-text-muted)' }}>
                Which CLI will power this agent?
              </p>
              <div className="flex flex-col gap-3">
                {CLI_OPTIONS.map((cli) => {
                  const Icon = cli.icon;
                  const selected = selectedCLI === cli.id;
                  return (
                    <button key={cli.id}
                      className="flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? 'rgba(137,180,250,0.08)' : 'var(--os-surface)',
                        border: `1px solid ${selected ? 'var(--os-accent)' : 'transparent'}`,
                      }}
                      onClick={() => setSelectedCLI(cli.id)}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: selected ? 'rgba(137,180,250,0.15)' : 'rgba(255,255,255,0.04)' }}>
                        <Icon size={20} style={{ color: selected ? 'var(--os-accent)' : 'var(--os-text-muted)' }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{cli.name}</div>
                        <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>{cli.desc}</div>
                      </div>
                      {selected && <Check size={16} style={{ color: 'var(--os-accent)' }} />}
                    </button>
                  );
                })}
              </div>
              <button
                className="w-full mt-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
                onClick={() => setCreateStep('config')}
              >
                Continue <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Step 2: Configure */}
          {createStep === 'config' && (
            <div>
              <h2 className="text-base font-semibold mb-1.5">Configure your agent</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--os-text-muted)' }}>
                Give it a name and workspace.
              </p>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--os-text-muted)' }}>
                    Agent Name
                  </label>
                  <input type="text" value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Project Manager, Code Reviewer..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ border: '1px solid var(--os-window-border)', color: 'var(--os-text)',
                      background: 'var(--os-surface)', userSelect: 'text' }} />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--os-text-muted)' }}>
                    Working Directory
                  </label>
                  <input type="text" value={agentWorkdir}
                    onChange={(e) => setAgentWorkdir(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ border: '1px solid var(--os-window-border)', color: 'var(--os-text)',
                      background: 'var(--os-surface)', userSelect: 'text' }} />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--os-text-muted)' }}>
                    Permission Mode
                  </label>
                  <div className="flex gap-2">
                    {[{ id: 'normal', label: 'Normal', desc: 'Asks for approval' },
                      { id: 'bypass', label: 'Bypass', desc: 'Full auto-approve' }].map((m) => (
                      <button key={m.id}
                        className="flex-1 px-3 py-2.5 rounded-lg text-left transition-all"
                        style={{
                          background: agentMode === m.id ? 'rgba(137,180,250,0.08)' : 'var(--os-surface)',
                          border: `1px solid ${agentMode === m.id ? 'var(--os-accent)' : 'var(--os-window-border)'}`,
                        }}
                        onClick={() => setAgentMode(m.id)}
                      >
                        <div className="text-xs font-medium">{m.label}</div>
                        <div className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                className="w-full mt-5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
                onClick={() => setCreateStep('confirm')}
              >
                Continue <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {createStep === 'confirm' && (
            <div>
              <h2 className="text-base font-semibold mb-1.5">Ready to create</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--os-text-muted)' }}>
                Review and confirm your agent setup.
              </p>

              <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--os-surface)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(137,180,250,0.1)' }}>
                    {'\u{1F916}'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{agentName || 'New Agent'}</div>
                    <div className="text-xs" style={{ color: 'var(--os-text-muted)' }}>
                      {CLI_OPTIONS.find(c => c.id === selectedCLI)?.name}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--os-text-muted)' }}>Engine</span>
                    <span>{CLI_OPTIONS.find(c => c.id === selectedCLI)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--os-text-muted)' }}>Workspace</span>
                    <span className="truncate ml-4">{agentWorkdir}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--os-text-muted)' }}>Mode</span>
                    <span>{agentMode}</span>
                  </div>
                </div>
              </div>

              <button
                className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
                onClick={createAgent}
              >
                <Sparkles size={14} />
                Create Agent
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === HOME VIEW ===
  return (
    <div className="flex flex-col h-full" style={{ background: '#1e1e2e', color: 'var(--os-text)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--os-window-border)', background: 'var(--os-titlebar)' }}>
        <Bot size={16} style={{ color: 'var(--os-accent)' }} />
        <span className="text-sm font-medium flex-1">Agents</span>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs"
          style={{ background: 'var(--os-surface)' }}>
          <Search size={11} style={{ color: 'var(--os-text-muted)' }} />
          <input type="text" placeholder="Search agents..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none text-xs w-28"
            style={{ color: 'var(--os-text)', userSelect: 'text' }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div className="flex gap-3 mb-5">
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ background: 'var(--os-accent)', color: '#1e1e2e' }}
                onClick={() => { setView('create'); setCreateStep('type'); }}
              >
                <Plus size={13} />
                Create Agent
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                style={{ border: '1px solid var(--os-window-border)', color: 'var(--os-text-muted)' }}
                onClick={() => setView('library')}
              >
                <Package size={13} />
                Agent Library
              </button>
            </div>

            {/* Installed agents grid */}
            {filteredAgents.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider"
                  style={{ color: 'var(--os-text-muted)' }}>
                  Installed ({filteredAgents.length})
                </h3>
                <div className="grid grid-cols-3 gap-5">
                  {filteredAgents.map((agent) => (
                    <button key={agent.name}
                      className="flex flex-col items-center gap-3 px-4 py-6 rounded-2xl transition-all hover:bg-white/5 cursor-pointer group"
                      style={{ background: 'var(--os-surface)' }}
                      onClick={() => { setSelectedAgent(agent); setView('detail'); }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
                        style={{ background: `${getAgentColor(agent.name)}12`, border: `1px solid ${getAgentColor(agent.name)}25` }}>
                        {getAgentIcon(agent.name)}
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium truncate max-w-[100px]">{agent.name}</div>
                        {agent.model && (
                          <div className="text-[9px] mt-0.5" style={{ color: 'var(--os-text-muted)' }}>{agent.model}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3"
                style={{ color: 'var(--os-text-muted)' }}>
                <Bot size={40} strokeWidth={1} />
                <div className="text-center">
                  <div className="text-sm font-medium mb-1" style={{ color: 'var(--os-text)' }}>No agents yet</div>
                  <div className="text-xs">Create a new agent or browse the library.</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
