import type { DirNode, NodeId, TreeState } from '@/types';

export function treeToTabIndent(state: TreeState): string {
  if (!state.rootId) return '';
  const lines: string[] = [];
  emit(state, state.rootId, 0, lines, (name, isDir, depth) => {
    const prefix = '\t'.repeat(depth);
    return prefix + name + (isDir ? '/' : '');
  });
  return lines.join('\n');
}

export function treeToMarkdown(state: TreeState, bullet: '-' | '*' | '+' = '-'): string {
  if (!state.rootId) return '';
  const lines: string[] = [];
  emit(state, state.rootId, 0, lines, (name, isDir, depth) => {
    const prefix = '  '.repeat(depth);
    return `${prefix}${bullet} ${name}${isDir ? '/' : ''}`;
  });
  return lines.join('\n');
}

function emit(
  state: TreeState,
  nodeId: NodeId,
  depth: number,
  lines: string[],
  fmt: (name: string, isDir: boolean, depth: number) => string,
): void {
  const node = state.nodes[nodeId];
  if (!node || node.dirty === 'deleted') return;
  lines.push(fmt(node.name, node.kind === 'dir', depth));
  if (node.kind === 'dir') {
    for (const childId of (node as DirNode).childIds) {
      emit(state, childId, depth + 1, lines, fmt);
    }
  }
}
