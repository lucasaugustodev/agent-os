import { useState, useEffect, useRef } from 'react';
import {
  GitBranch, GitPullRequest, CircleDot, Star, GitFork,
  ExternalLink, Brain, Send, X, Loader2, RefreshCw, Bell,
} from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface Repo {
  name: string;
  description: string;
  visibility: string;
  updatedAt: string;
  url: string;
  primaryLanguage?: { name: string };
}

interface Issue {
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  labels: { name: string; color: string }[];
  url: string;
}

interface PR {
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  url: string;
  headRefName: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', Ruby: '#701516',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883',
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 2592000)}mo`;
}

// ─── AI Sidebar ───
function GHSidebar({ account, onClose }: { account: string; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setThinking(true);

    const ownerName = account || '';
    const prompt = `[EXECUTE com shell. Portugues BR. GitHub CLI: sudo -u claude gh. Owner: ${ownerName}.
Pedido: ${text}]`;

    try {
      const res = await fetch('/api/smol/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.result || data.error || 'No response' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'Connection error.' }]);
    }
    setThinking(false);
  }

  return (
    <div className="flex flex-col h-full w-[280px] shrink-0"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,15,0.6)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Brain size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--os-text)' }}>GitHub AI</span>
        <button className="p-1 rounded hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={12} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Crie repos, issues, PRs, clone projetos...
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[95%] px-2.5 py-1.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === 'user' ? 'rgba(0,229,204,0.12)' : 'rgba(255,255,255,0.04)',
                color: msg.role === 'system' ? 'var(--os-yellow)' : 'var(--os-text)',
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Loader2 size={10} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
              <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>Working...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about GitHub..."
          className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--os-text-muted)]"
          style={{ color: 'var(--os-text)' }} />
        <button className="p-1.5 rounded-lg cursor-pointer" onClick={handleSend}
          style={{ color: input.trim() ? 'var(--os-accent)' : 'var(--os-text-muted)' }}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Login Screen ───
function LoginScreen({ onLoggedIn }: { onLoggedIn: (account: string) => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/github/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        onLoggedIn(data.account || 'unknown');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center h-full" style={{ background: '#0a0e17' }}>
      <div className="w-80 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <GitBranch size={28} className="mx-auto mb-3" style={{ color: 'var(--os-accent)' }} />
        <h2 className="text-center text-sm font-semibold mb-1" style={{ color: 'var(--os-text)' }}>GitHub Login</h2>
        <p className="text-center text-[11px] mb-4" style={{ color: 'var(--os-text-muted)' }}>
          Cole seu Personal Access Token do GitHub
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full px-3 py-2 rounded-lg text-xs bg-transparent outline-none mb-3"
          style={{ color: 'var(--os-text)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        {error && <p className="text-[11px] mb-2" style={{ color: 'var(--os-red)' }}>{error}</p>}
        <button
          className="w-full py-2 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: 'var(--os-accent)', color: '#0a0e17' }}
          onClick={handleLogin}
          disabled={loading}>
          {loading ? 'Autenticando...' : 'Entrar'}
        </button>
        <p className="text-center text-[10px] mt-3" style={{ color: 'var(--os-text-muted)' }}>
          Gere em github.com/settings/tokens
        </p>
      </div>
    </div>
  );
}

// ─── Main GitHub App ───
export default function GitHubCLI(_props: AppComponentProps) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [tab, setTab] = useState<'repos' | 'issues' | 'prs' | 'notifications'>('repos');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [prs, setPRs] = useState<PR[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch('/api/github/auth').then(r => r.json()).then(d => {
      setAuthed(d.loggedIn);
      setAccount(d.account);
      if (d.loggedIn) loadRepos();
      else setLoading(false);
    }).catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  function handleLoggedIn(acc: string) {
    setAuthed(true);
    setAccount(acc);
    loadRepos();
  }

  if (authed === null) return <div className="flex items-center justify-center h-full" style={{ background: '#0a0e17' }}><Loader2 size={20} className="animate-spin" style={{ color: 'var(--os-accent)' }} /></div>;
  if (!authed) return <LoginScreen onLoggedIn={handleLoggedIn} />;

  async function loadRepos() {
    setLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      setRepos(await res.json());
    } catch {}
    setLoading(false);
  }

  async function loadIssues(repo: string) {
    setLoading(true);
    setSelectedRepo(repo);
    setTab('issues');
    try {
      const [owner, name] = repo.split('/');
      const res = await fetch(`/api/github/issues/${owner}/${name}`);
      setIssues(await res.json());
    } catch {}
    setLoading(false);
  }

  async function loadPRs(repo: string) {
    setLoading(true);
    setSelectedRepo(repo);
    setTab('prs');
    try {
      const [owner, name] = repo.split('/');
      const res = await fetch(`/api/github/prs/${owner}/${name}`);
      setPRs(await res.json());
    } catch {}
    setLoading(false);
  }

  async function loadNotifications() {
    setLoading(true);
    setTab('notifications');
    try {
      const res = await fetch('/api/github/notifications');
      setNotifications(await res.json());
    } catch {}
    setLoading(false);
  }

  const owner = account || '';

  return (
    <div className="flex h-full" style={{ background: '#0a0e17' }}>
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <GitBranch size={15} style={{ color: 'var(--os-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--os-text)' }}>GitHub</span>
          {account && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,229,204,0.1)', color: 'var(--os-accent)' }}>
              @{account}
            </span>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 ml-3">
            {(['repos', 'notifications'] as const).map(t => (
              <button key={t}
                className="px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors"
                style={{
                  background: tab === t ? 'rgba(0,229,204,0.1)' : 'transparent',
                  color: tab === t ? 'var(--os-accent)' : 'var(--os-text-muted)',
                }}
                onClick={() => t === 'notifications' ? loadNotifications() : (setTab('repos'), loadRepos())}>
                {t === 'repos' ? 'Repos' : 'Notif'}
              </button>
            ))}
            {selectedRepo && (
              <>
                <button className="px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors"
                  style={{
                    background: tab === 'issues' ? 'rgba(0,229,204,0.1)' : 'transparent',
                    color: tab === 'issues' ? 'var(--os-accent)' : 'var(--os-text-muted)',
                  }}
                  onClick={() => loadIssues(selectedRepo)}>Issues</button>
                <button className="px-2.5 py-1 rounded-lg text-[11px] cursor-pointer transition-colors"
                  style={{
                    background: tab === 'prs' ? 'rgba(0,229,204,0.1)' : 'transparent',
                    color: tab === 'prs' ? 'var(--os-accent)' : 'var(--os-text-muted)',
                  }}
                  onClick={() => loadPRs(selectedRepo)}>PRs</button>
              </>
            )}
          </div>

          {selectedRepo && (
            <span className="text-[10px] px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}>
              {selectedRepo.split('/').pop()}
            </span>
          )}

          <div className="flex-1" />
          <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
            style={{ color: 'var(--os-text-muted)' }}
            onClick={() => tab === 'repos' ? loadRepos() : tab === 'issues' && selectedRepo ? loadIssues(selectedRepo) : tab === 'prs' && selectedRepo ? loadPRs(selectedRepo) : loadNotifications()}>
            <RefreshCw size={12} />
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{
              background: showAI ? 'var(--os-accent)' : 'rgba(255,255,255,0.04)',
              color: showAI ? '#0a0e17' : 'var(--os-text-muted)',
            }}
            onClick={() => setShowAI(!showAI)}>
            <Brain size={13} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
            </div>
          ) : tab === 'repos' ? (
            <div className="space-y-2">
              {repos.map(repo => (
                <div key={repo.name}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => loadIssues(`${owner}/${repo.name}`)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--os-accent)' }}>{repo.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: repo.visibility === 'private' ? 'rgba(255,184,77,0.1)' : 'rgba(0,229,204,0.1)', color: repo.visibility === 'private' ? 'var(--os-yellow)' : 'var(--os-accent)' }}>
                        {repo.visibility}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--os-text-muted)' }}>{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      {repo.primaryLanguage && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: LANG_COLORS[repo.primaryLanguage.name] || '#888' }} />
                          {repo.primaryLanguage.name}
                        </span>
                      )}
                      <span>{timeAgo(repo.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); loadIssues(`${owner}/${repo.name}`); }}>
                      <CircleDot size={10} /> Issues
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); loadPRs(`${owner}/${repo.name}`); }}>
                      <GitPullRequest size={10} /> PRs
                    </button>
                  </div>
                </div>
              ))}
              {repos.length === 0 && (
                <div className="text-center py-16" style={{ color: 'var(--os-text-muted)' }}>
                  <GitBranch size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                  <p className="text-xs">No repositories found</p>
                </div>
              )}
            </div>
          ) : tab === 'issues' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <button className="text-[11px] cursor-pointer" style={{ color: 'var(--os-accent)' }}
                  onClick={() => { setTab('repos'); setSelectedRepo(null); }}>
                  ← Repos
                </button>
                <span className="text-[11px]" style={{ color: 'var(--os-text-muted)' }}>/ {selectedRepo} / Issues</span>
              </div>
              {issues.map(issue => (
                <div key={issue.number}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <CircleDot size={14} style={{ color: issue.state === 'OPEN' ? 'var(--os-accent)' : 'var(--os-mauve)', marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{issue.title}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>#{issue.number}</span>
                      <span>{issue.author?.login}</span>
                      <span>{timeAgo(issue.createdAt)}</span>
                      {issue.labels?.map(l => (
                        <span key={l.name} className="px-1.5 py-0.5 rounded" style={{ background: `#${l.color}22`, color: `#${l.color}` }}>{l.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {issues.length === 0 && <p className="text-center py-8 text-xs" style={{ color: 'var(--os-text-muted)' }}>No open issues</p>}
            </div>
          ) : tab === 'prs' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <button className="text-[11px] cursor-pointer" style={{ color: 'var(--os-accent)' }}
                  onClick={() => { setTab('repos'); setSelectedRepo(null); }}>
                  ← Repos
                </button>
                <span className="text-[11px]" style={{ color: 'var(--os-text-muted)' }}>/ {selectedRepo} / Pull Requests</span>
              </div>
              {prs.map(pr => (
                <div key={pr.number}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <GitPullRequest size={14} style={{ color: pr.state === 'OPEN' ? 'var(--os-accent)' : 'var(--os-mauve)', marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{pr.title}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>#{pr.number}</span>
                      <span className="flex items-center gap-1"><GitBranch size={9} />{pr.headRefName}</span>
                      <span>{pr.author?.login}</span>
                      <span>{timeAgo(pr.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {prs.length === 0 && <p className="text-center py-8 text-xs" style={{ color: 'var(--os-text-muted)' }}>No open PRs</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: any, i: number) => (
                <div key={n.id || i}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <Bell size={14} style={{ color: 'var(--os-accent)', marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{n.title}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
                      <span>{n.repo}</span>
                      <span>{n.type}</span>
                      <span>{n.reason}</span>
                      {n.updated && <span>{timeAgo(n.updated)}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <p className="text-center py-8 text-xs" style={{ color: 'var(--os-text-muted)' }}>No notifications</p>}
            </div>
          )}
        </div>
      </div>

      {/* AI Sidebar */}
      {showAI && <GHSidebar account={account || ''} onClose={() => setShowAI(false)} />}
    </div>
  );
}
