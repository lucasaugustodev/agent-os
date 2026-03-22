import type { AppComponentProps } from '../../types/os';

export default function TerminalApp(_props: AppComponentProps) {
  return (
    <iframe
      src="http://localhost:7681"
      className="w-full h-full border-none"
      style={{ background: '#0a0e17' }}
      title="Terminal"
    />
  );
}
