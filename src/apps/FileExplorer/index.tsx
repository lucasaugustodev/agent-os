import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder, File, ArrowUp, Download, Trash2, Plus, Upload,
  ChevronRight, Image, Film, Music, FileText, Archive, Code,
  Eye, Edit3, Save, X, Loader2, Brain, Send,
} from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

const API = '/api/launcher/files';
const LAUNCHER_API = '/api/launcher';
const WS_URL = `ws://${window.location.host}/ws`;

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  permissions?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <Folder size={16} style={{ color: 'var(--os-accent)' }} />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)) return <Image size={16} style={{ color: '#a78bfa' }} />;
  if (['mp4','webm','mov','avi','mkv'].includes(ext)) return <Film size={16} style={{ color: '#f472b6' }} />;
  if (['mp3','wav','ogg','flac','aac'].includes(ext)) return <Music size={16} style={{ color: '#34d399' }} />;
  if (['zip','tar','gz','rar','7z','bz2'].includes(ext)) return <Archive size={16} style={{ color: '#fbbf24' }} />;
  if (['js','ts','tsx','jsx','py','rs','go','java','c','cpp','h','rb','sh','bat','ps1'].includes(ext)) return <Code size={16} style={{ color: '#60a5fa' }} />;
  if (['md','txt','log','csv','json','yaml','yml','xml','toml','ini','cfg','conf','env'].includes(ext)) return <FileText size={16} style={{ color: '#94a3b8' }} />;
  return <File size={16} style={{ color: 'var(--os-text-muted)' }} />;
}

function isPreviewable(name: string): 'image' | 'video' | 'audio' | 'text' | 'pdf' | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)) return 'image';
  if (['mp4','webm','ogg','mov'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','flac','aac','m4a'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['js','ts','tsx','jsx','py','rs','go','java','c','cpp','h','rb','sh','bat','ps1',
    'md','txt','log','csv','json','yaml','yml','xml','toml','ini','cfg','conf','env',
    'html','css','scss','sql','dockerfile','makefile','gitignore'].includes(ext)) return 'text';
  return null;
}

// ─── SmolAgent Sidebar Chat ───
function SmolSidebar({ currentPath, onClose }: { currentPath: string; onClose: () => void }) {
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

    const prompt = `[Contexto: usuário navegando em ${currentPath}] ${text}`;
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
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Brain size={14} style={{ color: 'var(--os-accent)' }} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: 'var(--os-text)' }}>FS Assistant</span>
        <button className="p-1 rounded hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={12} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--os-accent)', opacity: 0.3 }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Ask me to find files, organize folders, analyze content...
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

      {/* Input */}
      <div className="flex items-center gap-1 px-2 py-2 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about files..."
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

// ─── File Viewer/Editor Overlay ───
function FileViewer({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  const [content, setContent] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const name = filePath.split('/').pop() || '';
  const type = isPreviewable(name);
  const downloadUrl = `${API}/download?path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    if (type === 'text') {
      fetch(`${API}/read?path=${encodeURIComponent(filePath)}`)
        .then(r => r.json())
        .then(d => { setContent(d.content || ''); setEditContent(d.content || ''); })
        .catch(() => setContent('Error reading file'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [filePath, type]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: editContent }),
      });
      setContent(editContent);
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(5,8,15,0.95)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--os-text)' }}>{name}</span>
        {type === 'text' && !editing && (
          <button className="px-2.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-white/5 flex items-center gap-1"
            style={{ color: 'var(--os-accent)' }} onClick={() => setEditing(true)}>
            <Edit3 size={12} /> Edit
          </button>
        )}
        {editing && (
          <button className="px-2.5 py-1 rounded-lg text-xs cursor-pointer flex items-center gap-1"
            style={{ background: 'var(--os-accent)', color: '#0a0e17' }}
            onClick={handleSave} disabled={saving}>
            <Save size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}
        <a href={downloadUrl} download className="px-2.5 py-1 rounded-lg text-xs cursor-pointer hover:bg-white/5 flex items-center gap-1"
          style={{ color: 'var(--os-text-muted)' }}>
          <Download size={12} /> Download
        </a>
        <button className="p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" onClick={onClose}>
          <X size={16} style={{ color: 'var(--os-text-muted)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
          </div>
        ) : type === 'image' ? (
          <div className="flex items-center justify-center h-full">
            <img src={downloadUrl} alt={name} className="max-w-full max-h-full object-contain rounded-lg"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }} />
          </div>
        ) : type === 'video' ? (
          <div className="flex items-center justify-center h-full">
            <video src={downloadUrl} controls className="max-w-full max-h-full rounded-lg" />
          </div>
        ) : type === 'audio' ? (
          <div className="flex items-center justify-center h-full">
            <audio src={downloadUrl} controls className="w-full max-w-md" />
          </div>
        ) : type === 'pdf' ? (
          <iframe src={downloadUrl} className="w-full h-full rounded-lg" style={{ border: 'none' }} />
        ) : type === 'text' ? (
          editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full bg-transparent resize-none outline-none text-[13px] leading-relaxed"
              style={{ color: 'var(--os-text)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
              onKeyDown={(e) => {
                if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const ta = e.target as HTMLTextAreaElement;
                  const start = ta.selectionStart;
                  setEditContent(editContent.substring(0, start) + '  ' + editContent.substring(ta.selectionEnd));
                  setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
                }
              }}
            />
          ) : (
            <pre className="text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--os-text)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
              {content}
            </pre>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--os-text-muted)' }}>
            Preview not available for this file type.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main File Explorer ───
export default function FileExplorer(_props: AppComponentProps) {
  const [currentPath, setCurrentPath] = useState('/home/claude');
  const [items, setItems] = useState<FileItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAssistant, setShowAssistant] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      setItems(data.items || []);
      setCurrentPath(data.path || dirPath);
      setParentPath(data.parent || null);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { loadDir(currentPath); }, [currentPath]); // eslint-disable-line

  // File watcher via WebSocket
  const fsWsRef = useRef<WebSocket | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    fsWsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'fs:watch', path: currentPath }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'fs:change') {
          // Debounce - reload after 300ms of no changes
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => loadDir(currentPath), 300);
        }
      } catch {}
    };

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      ws.close();
      fsWsRef.current = null;
    };
  }, [currentPath, loadDir]);

  function navigate(path: string) { loadDir(path); }

  async function handleUpload(files: FileList) {
    const form = new FormData();
    form.append('path', currentPath);
    for (const f of Array.from(files)) form.append('files', f);
    try {
      await fetch(`${API}/upload`, { method: 'POST', body: form });
      loadDir(currentPath);
    } catch {}
  }

  async function handleDelete(item: FileItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await fetch(`${API}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      });
      loadDir(currentPath);
    } catch {}
  }

  async function handleNewFolder() {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath + '/' + newFolderName.trim();
    try {
      await fetch(`${API}/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
      setShowNewFolder(false);
      setNewFolderName('');
      loadDir(currentPath);
    } catch {}
  }

  function handleDownload(item: FileItem) {
    const url = `${API}/download?path=${encodeURIComponent(item.path)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    name: part,
    path: '/' + pathParts.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="flex h-full relative" style={{ background: '#0a0e17' }}>
      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Viewer overlay */}
        {viewingFile && <FileViewer filePath={viewingFile} onClose={() => setViewingFile(null)} />}

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Back */}
          <button className="p-1 rounded hover:bg-white/5 cursor-pointer shrink-0"
            style={{ color: 'var(--os-text-muted)' }}
            onClick={() => parentPath && navigate(parentPath)} disabled={!parentPath}>
            <ArrowUp size={14} />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto text-xs">
            <button className="px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer shrink-0"
              style={{ color: 'var(--os-accent)' }} onClick={() => navigate('/')}>
              /
            </button>
            {breadcrumbs.map((bc, i) => (
              <span key={bc.path} className="flex items-center shrink-0">
                <ChevronRight size={10} style={{ color: 'var(--os-text-muted)' }} />
                <button
                  className="px-1.5 py-0.5 rounded hover:bg-white/5 cursor-pointer truncate max-w-[120px]"
                  style={{ color: i === breadcrumbs.length - 1 ? 'var(--os-text)' : 'var(--os-text-muted)' }}
                  onClick={() => navigate(bc.path)}>
                  {bc.name}
                </button>
              </span>
            ))}
          </div>

          {/* Actions */}
          <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/5"
            style={{ color: 'var(--os-text-muted)' }}
            onClick={() => setShowNewFolder(true)}>
            <Plus size={12} /> Folder
          </button>
          <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
            style={{ background: 'rgba(0,229,204,0.1)', color: 'var(--os-accent)' }}
            onClick={() => uploadRef.current?.click()}>
            <Upload size={12} /> Upload
          </button>
          <input ref={uploadRef} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ''; }} />

          {/* SmolAgent toggle */}
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            style={{
              background: showAssistant ? 'var(--os-accent)' : 'rgba(255,255,255,0.04)',
              color: showAssistant ? '#0a0e17' : 'var(--os-text-muted)',
            }}
            onClick={() => setShowAssistant(!showAssistant)}
            title="FS Assistant (SmolAgent)">
            <Brain size={13} />
          </button>
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex items-center gap-2 px-4 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <Folder size={14} style={{ color: 'var(--os-accent)' }} />
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNewFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
              placeholder="Folder name..." autoFocus
              className="flex-1 bg-transparent text-xs outline-none" style={{ color: 'var(--os-text)' }} />
            <button className="text-xs px-2 py-1 rounded cursor-pointer"
              style={{ background: 'var(--os-accent)', color: '#0a0e17' }} onClick={handleNewFolder}>Create</button>
            <button className="text-xs px-2 py-1 rounded cursor-pointer hover:bg-white/5"
              style={{ color: 'var(--os-text-muted)' }} onClick={() => setShowNewFolder(false)}>Cancel</button>
          </div>
        )}

        {/* File list */}
        <div
          className="flex-1 overflow-auto"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
          style={dragging ? { outline: '2px dashed var(--os-accent)', outlineOffset: '-4px', background: 'rgba(0,229,204,0.03)' } : {}}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--os-accent)' }} />
            </div>
          ) : (
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--os-text-muted)' }}>Name</th>
                  <th className="text-right px-3 py-2 font-medium w-20" style={{ color: 'var(--os-text-muted)' }}>Size</th>
                  <th className="text-right px-3 py-2 font-medium w-36 hidden sm:table-cell" style={{ color: 'var(--os-text-muted)' }}>Modified</th>
                  <th className="text-right px-3 py-2 font-medium w-32" style={{ color: 'var(--os-text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parentPath && (
                  <tr className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                    onClick={() => navigate(parentPath)}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <ArrowUp size={14} style={{ color: 'var(--os-text-muted)' }} />
                      <span style={{ color: 'var(--os-text-muted)' }}>..</span>
                    </td>
                    <td /><td className="hidden sm:table-cell" /><td />
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.path}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                    onClick={() => {
                      if (item.isDirectory) navigate(item.path);
                      else if (isPreviewable(item.name)) setViewingFile(item.path);
                    }}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {getFileIcon(item.name, item.isDirectory)}
                        <span className="truncate" style={{ color: item.isDirectory ? 'var(--os-accent)' : 'var(--os-text)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2" style={{ color: 'var(--os-text-muted)' }}>
                      {item.isDirectory ? '-' : formatSize(item.size)}
                    </td>
                    <td className="text-right px-3 py-2 hidden sm:table-cell" style={{ color: 'var(--os-text-muted)' }}>
                      {formatDate(item.modified)}
                    </td>
                    <td className="text-right px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {!item.isDirectory && isPreviewable(item.name) && (
                          <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--os-text-muted)' }}
                            onClick={(e) => { e.stopPropagation(); setViewingFile(item.path); }}>
                            <Eye size={11} /> View
                          </button>
                        )}
                        {!item.isDirectory && (
                          <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                            style={{ background: 'rgba(0,229,204,0.08)', color: 'var(--os-accent)' }}
                            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                            <Download size={11} /> DL
                          </button>
                        )}
                        <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer"
                          style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--os-red)' }}
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="text-center py-16" style={{ color: 'var(--os-text-muted)' }}>
                      <Folder size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                      <p className="text-xs">Empty directory</p>
                      <p className="text-[10px] mt-1">Drag files here or click Upload</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SmolAgent Sidebar */}
      {showAssistant && <SmolSidebar currentPath={currentPath} onClose={() => setShowAssistant(false)} />}
    </div>
  );
}
