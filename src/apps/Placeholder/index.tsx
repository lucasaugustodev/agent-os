import type { AppComponentProps } from '../../types/os';

export default function PlaceholderApp({ appId }: AppComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8"
      style={{ color: 'var(--os-text-muted)' }}
    >
      <div className="text-4xl">
        {appId === 'terminal' ? '>' :
         appId === 'inbox' ? '📥' :
         appId === 'mission-control' ? '📋' :
         appId === 'agents' ? '🤖' :
         appId === 'finder' ? '📁' :
         appId === 'settings' ? '⚙️' : '🖥️'}
      </div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--os-text)' }}>
        {appId.charAt(0).toUpperCase() + appId.slice(1).replace('-', ' ')}
      </h2>
      <p className="text-sm text-center max-w-xs">
        This app is coming soon. The window management is fully functional —
        try dragging, resizing, minimizing, and maximizing this window.
      </p>
    </div>
  );
}
