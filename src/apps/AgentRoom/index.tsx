import { useEffect, useRef } from 'react';
import { RoomEngine, type AgentData } from './engine/room';
import type { AvatarState } from './engine/avatar';
import type { AppComponentProps } from '../../types/os';
import { useAppStore } from '../../stores/useAppStore';

// Demo agents for showcase
const DEMO_AGENTS: AgentData[] = [
  { id: 'agent-ceo', name: 'CEO', state: 'idle', col: 4, row: 2, z: 0, paletteIndex: 0 },
  { id: 'agent-dev', name: 'Developer', state: 'working', col: 2, row: 4, z: 0, paletteIndex: 1 },
  { id: 'agent-qa', name: 'QA Tester', state: 'sitting', col: 6, row: 3, z: 0, paletteIndex: 2 },
  { id: 'agent-design', name: 'Designer', state: 'waving', col: 3, row: 6, z: 0, paletteIndex: 3 },
  { id: 'agent-devops', name: 'DevOps', state: 'walking', col: 5, row: 5, z: 0, paletteIndex: 4 },
  { id: 'agent-pm', name: 'PM', state: 'idle', col: 7, row: 4, z: 0, paletteIndex: 5 },
];

// Agent movement patterns for demo
const MOVEMENT_PATTERNS: Record<string, { cols: number[]; rows: number[] }> = {
  'agent-devops': { cols: [5, 6, 7, 6, 5, 4, 3, 4], rows: [5, 5, 4, 3, 3, 4, 5, 5] },
  'agent-dev': { cols: [2, 2, 3, 3, 2], rows: [4, 3, 3, 4, 4] },
};

export default function AgentRoom(_props: AppComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RoomEngine | null>(null);
  const intervalsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const launchApp = useAppStore.getState().launchApp;

    const engine = new RoomEngine({
      cols: 10,
      rows: 9,
      onAgentClick: (agentId: string) => {
        const agent = DEMO_AGENTS.find((a) => a.id === agentId);
        if (agent) {
          launchApp('terminal', {
            title: `Terminal — ${agent.name}`,
            data: { agentId },
          });
        }
      },
      onTileClick: (col: number, row: number) => {
        engineRef.current?.moveAgent('agent-ceo', col, row, 0, 600);
      },
    });
    engineRef.current = engine;

    let mounted = true;

    engine.init(canvas).then(() => {
      if (!mounted) return;

      // Add demo agents
      for (const agent of DEMO_AGENTS) {
        engine.addAgent(agent);
      }

      // Start demo movement patterns
      for (const [agentId, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
        let step = 0;
        const interval = window.setInterval(() => {
          if (!mounted) return;
          const col = pattern.cols[step % pattern.cols.length];
          const row = pattern.rows[step % pattern.rows.length];
          engine.moveAgent(agentId, col, row, 0, 800);
          step++;
        }, 2000);
        intervalsRef.current.push(interval);
      }

      // Cycle agent states for demo
      const stateInterval = window.setInterval(() => {
        if (!mounted) return;
        const states: AvatarState[] = ['idle', 'working', 'sitting', 'waving', 'error'];
        const randomAgent = DEMO_AGENTS[Math.floor(Math.random() * DEMO_AGENTS.length)];
        const randomState = states[Math.floor(Math.random() * states.length)];
        engine.updateAgentState(randomAgent.id, randomState);
      }, 5000);
      intervalsRef.current.push(stateInterval);
    });

    // Resize handler
    const parent = canvas.parentElement;
    const ro = parent ? new ResizeObserver(() => engine.resize()) : null;
    if (parent) ro!.observe(parent);

    return () => {
      mounted = false;
      ro?.disconnect();
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // stable — no deps, callbacks use refs/getState

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#1e1e2e' }}>
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Bottom status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-4 py-2 text-xs"
        style={{
          background: 'rgba(17,17,27,0.9)',
          borderTop: '1px solid var(--os-window-border)',
          color: 'var(--os-text-muted)',
        }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#a6e3a1' }} />
          {DEMO_AGENTS.length} agents online
        </span>
        <span className="opacity-50">|</span>
        <span>Click agent to open terminal</span>
        <span className="opacity-50">|</span>
        <span>Click tile to move CEO</span>
      </div>
    </div>
  );
}
