import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ArrowLeft, RefreshCw, Upload, Download, Loader2, Home } from 'lucide-react';
import type { AppComponentProps } from '../../types/os';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
  permissions?: string;
}

interface DirResponse {
  path: string;
  parent: string;
  items: FileItem[];
}

const BG = '#0a0e17';
const PANEL = '#0d1420';
const SURFACE = '#111928';
const BORDER = '#1a2332';
const ACCENT = '#00e5cc';
const TEXT = '#e0e0e0';
const MUTED = '#4a6080';

export default function FileExplorerApp(_props: AppComponentProps) {
  const [currentPath, setCurrentPath] = useState('/home/claude');
  const [dirData, setDirData] = useState<DirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchDir = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/launcher/files?path=' + encodeURIComponent(path));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: DirResponse = await res.json();
      setDirData(data);
      setCurrentPath(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDir(currentPath); }, []);

  const navigate = (item: FileItem) => {
    if (item.isDirectory) fetchDir(item.path);
  };

  const goUp = () => {
    if (dirData?.parent) fetchDir(dirData.parent);
  };

  const goHome = () => fetchDir('/home/claude');

  const downloadFile = async (item: FileItem) => {
    try {
      const res = await fetch('/api/launcher/files/download?path=' + encodeURIComponent(item.path));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao baixar');
    }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);
      const res = await fetch('/api/launcher/files/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await fetchDir(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao fazer upload');
    }
    setUploading(false);
    e.target.value = '';
  };

  const formatSize = (bytes?: number) => {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (s?: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: BG, color: TEXT }}>
      {/* Header / toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
        <button onClick={goHome} title="Home" className="p-1.5 rounded hover:bg-white/5" style={{ color: MUTED }}>
          <Home size={14} />
        </button>
        <button onClick={goUp} disabled={!dirData?.parent || dirData.parent === currentPath}
          title="Voltar" className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30" style={{ color: MUTED }}>
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 px-2 py-1 rounded text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ background: SURFACE, border: '1px solid ' + BORDER, color: TEXT }}>
          {currentPath}
        </div>
        <button onClick={() => fetchDir(currentPath)} title="Recarregar"
          className="p-1.5 rounded hover:bg-white/5" style={{ color: MUTED }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer"
          style={{ background: ACCENT + '20', color: ACCENT, border: '1px solid ' + ACCENT + '44' }}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Upload
          <input type="file" className="hidden" onChange={uploadFile} disabled={uploading} />
        </label>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 text-xs shrink-0"
          style={{ background: '#ef444420', color: '#ef4444', borderBottom: '1px solid #ef444433' }}>
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: MUTED }} />
            <span className="text-xs" style={{ color: MUTED }}>Carregando...</span>
          </div>
        )}
        {!loading && dirData && (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid ' + BORDER, background: PANEL }}>
                <th className="text-left px-4 py-2 font-medium" style={{ color: MUTED }}>Nome</th>
                <th className="text-right px-4 py-2 font-medium" style={{ color: MUTED }}>Tamanho</th>
                <th className="text-right px-4 py-2 font-medium" style={{ color: MUTED }}>Modificado</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {dirData.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8" style={{ color: MUTED }}>Pasta vazia</td>
                </tr>
              )}
              {dirData.items.map((item) => (
                <tr key={item.path}
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid ' + BORDER + '60', cursor: item.isDirectory ? 'pointer' : 'default' }}
                  onClick={() => navigate(item)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {item.isDirectory
                        ? <Folder size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        : <File size={14} style={{ color: MUTED, flexShrink: 0 }} />}
                      <span className="truncate max-w-xs" style={{ color: item.isDirectory ? TEXT : TEXT + 'cc' }}>
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: MUTED }}>
                    {item.isDirectory ? '-' : formatSize(item.size)}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: MUTED }}>
                    {formatDate(item.modified)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!item.isDirectory && (
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadFile(item); }}
                        title="Download"
                        className="p-1 rounded hover:bg-white/10"
                        style={{ color: ACCENT }}>
                        <Download size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-4 py-1.5" style={{ borderTop: '1px solid ' + BORDER, background: PANEL }}>
        <span className="text-xs" style={{ color: MUTED }}>
          {dirData ? dirData.items.length + ' item(s)' : ''}
        </span>
      </div>
    </div>
  );
}
