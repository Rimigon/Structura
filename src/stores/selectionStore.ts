import { create } from 'zustand';
import type { NodeId } from '@/types';

export interface SelectMods {
  ctrl: boolean;
  shift: boolean;
}

interface SelectionState {
  focusedId: NodeId | null;
  editingId: NodeId | null;
  multiSelect: Set<NodeId>;
  lastAnchorId: NodeId | null;
  select(id: NodeId, mods: SelectMods, orderedIds: NodeId[]): void;
  focus(id: NodeId | null): void;
  startEditing(id: NodeId | null): void;
  clearMulti(): void;
  clear(): void;
}

export const useSelectionStore = create<SelectionState>(set => ({
  focusedId: null,
  editingId: null,
  multiSelect: new Set(),
  lastAnchorId: null,

  select: (id, mods, orderedIds) =>
    set(state => {
      if (mods.shift && state.lastAnchorId) {
        const a = orderedIds.indexOf(state.lastAnchorId);
        const b = orderedIds.indexOf(id);
        if (a < 0 || b < 0) {
          return { multiSelect: new Set([id]), focusedId: id, lastAnchorId: id };
        }
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const next = new Set<NodeId>();
        for (let i = lo; i <= hi; i++) next.add(orderedIds[i]!);
        return { multiSelect: next, focusedId: id };
      }
      if (mods.ctrl) {
        const next = new Set(state.multiSelect);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { multiSelect: next, focusedId: id, lastAnchorId: id };
      }
      return { multiSelect: new Set(), focusedId: id, lastAnchorId: id };
    }),

  focus: id => set({ focusedId: id, lastAnchorId: id }),

  startEditing: id => set({ editingId: id }),

  clearMulti: () => set({ multiSelect: new Set() }),

  clear: () =>
    set({ focusedId: null, editingId: null, multiSelect: new Set(), lastAnchorId: null }),
}));
