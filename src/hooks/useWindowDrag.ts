import { useCallback, useRef } from 'react';
import type { Position } from '../types/os';

interface UseWindowDragOpts {
  onDragStart?: () => void;
  onDrag: (pos: Position) => void;
  onDragEnd?: () => void;
  constrainTo?: () => { width: number; height: number };
}

export function useWindowDrag({ onDragStart, onDrag, onDragEnd, constrainTo }: UseWindowDragOpts) {
  const offsetRef = useRef<Position>({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget.closest('[data-window]') as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isDragging.current = true;

      onDragStart?.();

      const handleMove = (ev: PointerEvent) => {
        if (!isDragging.current) return;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          let x = ev.clientX - offsetRef.current.x;
          let y = ev.clientY - offsetRef.current.y;

          // Keep at least 80px visible
          const bounds = constrainTo?.() ?? {
            width: window.innerWidth,
            height: window.innerHeight,
          };
          const minVisible = 80;
          x = Math.max(-rect.width + minVisible, Math.min(bounds.width - minVisible, x));
          y = Math.max(0, Math.min(bounds.height - 40, y));

          onDrag({ x, y });
        });
      };

      const handleUp = () => {
        isDragging.current = false;
        cancelAnimationFrame(rafRef.current);
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        onDragEnd?.();
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [onDragStart, onDrag, onDragEnd, constrainTo]
  );

  return { handlePointerDown };
}
