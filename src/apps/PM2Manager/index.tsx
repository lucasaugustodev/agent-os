import type { AppComponentProps } from '../../types/os';
export default function PM2ManagerApp(_props: AppComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3"
      style={{ background: '#0a0e17', color: '#4a6080' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
        style={{ background: '#111928', border: '1px solid #1a2332' }}>
        ⚙️
      </div>
      <h2 className="text-base font-semibold" style={{ color: '#e0e0e0' }}>PM2 Manager</h2>
      <p className="text-sm text-center max-w-xs">Gerenciamento de processos PM2.</p>
      <span className="text-xs px-3 py-1.5 rounded-full"
        style={{ background: '#111928', border: '1px solid #1a2332' }}>Em breve</span>
    </div>
  );
}
