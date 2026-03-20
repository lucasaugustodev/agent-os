import { useCallback, useRef } from 'react';
import type { Position, Size } from '../types/os';

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface UseWindowResizeOpts {
  position: Position;
  size: Size;
  minSize?: Size;
  onResize: (pos: Position, size: Size) => void;
  onResizeEnd?: () => void;
}

export function useWindowResize({
  position,
  size,
  minSize = { width: 400, height: 300 },
  onResize,
  onResizeEnd,
}: UseWindowResizeOpts) {
  const rafRef = useRef<number>(0);

  const startResize = useCallback(
    (e: React.PointerEvent, edge: Edge) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...position };
      const startSize = { ...size };

      const handleMove = (ev: PointerEvent) => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let newX = startPos.x;
          let newY = startPos.y;
          let newW = startSize.width;
          let newH = startSize.height;

          if (edge.includes('e')) newW = Math.max(minSize.width, startSize.width + dx);
          if (edge.includes('w')) {
            newW = Math.max(minSize.width, startSize.width - dx);
            newX = startPos.x + startSize.width - newW;
          }
          if (edge.includes('s')) newH = Math.max(minSize.height, startSize.height + dy);
          if (edge.includes('n')) {
            newH = Math.max(minSize.height, startSize.height - dy);
            newY = startPos.y + startSize.height - newH;
          }

          onResize({ x: newX, y: newY }, { width: newW, height: newH });
        });
      };

      const handleUp = () => {
        cancelAnimationFrame(rafRef.current);
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        onResizeEnd?.();
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [position, size, minSize, onResize, onResizeEnd]
  );

  return { startResize };
}

export type { Edge };
