import type { DiffEntry, DiffKind, DiffSummary, TreeState } from '@/types';
import { fsPathOf, pathOf } from '../tree/traverse';

export function computeDiff(before: TreeState, after: TreeState): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const beforeIds = new Set(Object.keys(before.nodes));
  const afterIds = new Set(Object.keys(after.nodes));

  for (const id of beforeIds) {
    const b = before.nodes[id]!;
    const a = after.nodes[id];
    const bPath = pathOf(before, id);

    if (!a || a.dirty === 'deleted') {
      entries.push({ nodeId: id, kind: 'removed', fromPath: bPath });
      continue;
    }
    const aPath = pathOf(after, id);
    if (a.parentId !== b.parentId) {
      entries.push({ nodeId: id, kind: 'moved', fromPath: bPath, toPath: aPath });
    } else if (a.name !== b.name) {
      entries.push({ nodeId: id, kind: 'renamed', fromPath: bPath, toPath: aPath });
    }
  }

  for (const id of afterIds) {
    if (beforeIds.has(id)) continue;
    const n = after.nodes[id]!;
    if (n.dirty === 'deleted') continue;
    entries.push({ nodeId: id, kind: 'added', toPath: pathOf(after, id) });
  }

  return entries;
}

export function summarize(entries: DiffEntry[]): DiffSummary {
  const s: DiffSummary = { added: 0, removed: 0, renamed: 0, moved: 0, total: 0 };
  for (const e of entries) {
    if (e.kind === 'unchanged') continue;
    s[e.kind as Exclude<DiffKind, 'unchanged'>]++;
    s.total++;
  }
  return s;
}

export function diffFromDirtyFlags(state: TreeState): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const node of Object.values(state.nodes)) {
    if (!node.dirty) continue;
    const toPath =
      node.dirty === 'deleted'
        ? undefined
        : (fsPathOf(state, node.id) ?? pathOf(state, node.id));
    const fromPath = node.originalPath;
    switch (node.dirty) {
      case 'new':
        entries.push({ nodeId: node.id, kind: 'added', toPath });
        break;
      case 'deleted':
        entries.push({ nodeId: node.id, kind: 'removed', fromPath });
        break;
      case 'moved':
        entries.push({ nodeId: node.id, kind: 'moved', fromPath, toPath });
        break;
      case 'renamed':
        entries.push({ nodeId: node.id, kind: 'renamed', fromPath, toPath });
        break;
    }
  }
  return entries;
}
