import { useCallback, useEffect, useRef, useState } from 'react';

// Drag-to-reorder over Pointer Events — one code path for mouse, touch and pen,
// and no dependency. Ported from ListMaster's settings reorder, simplified on
// one point: Bank's rows are a fixed height (names are forced to one line), so
// a seat is a constant slot and the midpoint hit-testing collapses to a single
// divide. Nothing is measured from the DOM.
export const ROW_HEIGHT = 56;
export const ROW_GAP = 8;
const SLOT = ROW_HEIGHT + ROW_GAP;

export interface PlayerDragState {
  id: string;
  translateY: number;
  originalOrder: string[];
  liveOrder: string[];
}

export interface PlayerDrag {
  state: PlayerDragState | null;
  // Vertical offset to render this row at, in px.
  offsetFor: (id: string) => number;
  startDrag: (event: React.PointerEvent, id: string) => void;
}

function move(order: string[], from: number, to: number): string[] {
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function usePlayerDrag(
  ids: string[],
  onCommit: (orderedIds: string[]) => void
): PlayerDrag {
  const [state, setState] = useState<PlayerDragState | null>(null);

  // The window listeners are registered once and never re-bound, so everything
  // they touch has to be reachable through a ref rather than a closure.
  const stateRef = useRef<PlayerDragState | null>(null);
  const startYRef = useRef(0);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const startDrag = useCallback((event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault(); // suppresses the iOS long-press callout
    event.currentTarget.setPointerCapture(event.pointerId);
    startYRef.current = event.clientY;
    const next: PlayerDragState = {
      id,
      translateY: 0,
      // Snapshot the roster at grab time. A player joining mid-drag must not
      // renumber the slots out from under the finger.
      originalOrder: ids,
      liveOrder: ids,
    };
    stateRef.current = next;
    setState(next);
  }, [ids]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = stateRef.current;
      if (!drag) return;
      // Recovers from a mouseup swallowed elsewhere, without breaking touch.
      if (event.pointerType === 'mouse' && event.buttons === 0) return;

      const dy = event.clientY - startYRef.current;
      const originalIndex = drag.originalOrder.indexOf(drag.id);
      if (originalIndex === -1) return;

      // Uniform slots, so the seat the row now covers is just its travel
      // divided by the slot height.
      const target = Math.min(
        drag.originalOrder.length - 1,
        Math.max(0, Math.round((originalIndex * SLOT + dy) / SLOT))
      );
      const liveIndex = drag.liveOrder.indexOf(drag.id);
      const liveOrder =
        target === liveIndex ? drag.liveOrder : move(drag.liveOrder, liveIndex, target);

      const next = { ...drag, translateY: dy, liveOrder };
      stateRef.current = next;
      setState(next);
    };

    const onEnd = () => {
      const drag = stateRef.current;
      stateRef.current = null;
      setState(null);
      if (!drag) return;
      if (drag.liveOrder.join() === drag.originalOrder.join()) return;
      commitRef.current(drag.liveOrder);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    // iOS cancels touches on its own (a call, a system gesture). Committing on
    // cancel rather than discarding means a drag never silently evaporates.
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, []);

  const offsetFor = useCallback(
    (id: string) => {
      if (!state) return 0;
      // The dragged row tracks the finger exactly; everyone else slides by
      // whole seats.
      if (id === state.id) return state.translateY;
      const from = state.originalOrder.indexOf(id);
      const to = state.liveOrder.indexOf(id);
      if (from === -1 || to === -1) return 0;
      return (to - from) * SLOT;
    },
    [state]
  );

  return { state, offsetFor, startDrag };
}
