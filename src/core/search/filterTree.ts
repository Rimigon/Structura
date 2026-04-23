import type { NodeId, TreeNode, TreeState } from '@/types';
import { pathOf } from '../tree/traverse';
import { matchGlob } from './glob';

export interface SearchOptions {
  pattern: string;
  field?: 'name' | 'path';
  kind?: 'file' | 'dir';
}

export function findMatchingIds(state: TreeState, opts: SearchOptions): NodeId[] {
  const { pattern, field = 'name', kind } = opts;
  if (!pattern.trim()) return [];
  const result: NodeId[] = [];
  for (const node of Object.values(state.nodes)) {
    if (node.dirty === 'deleted') continue;
    if (kind && node.kind !== kind) continue;
    const hay = field === 'path' ? pathOf(state, node.id) : node.name;
    if (matches(pattern, hay, node)) result.push(node.id);
  }
  return result;
}

function matches(pattern: string, hay: string, _node: TreeNode): boolean {
  if (isGlob(pattern)) return matchGlob(pattern, hay);
  return hay.toLowerCase().includes(pattern.toLowerCase());
}

function isGlob(s: string): boolean {
  return /[*?[]/.test(s);
}
