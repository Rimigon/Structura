import type { DirNode, FileNode, NodeId, TreeNode, TreeState } from '@/types';

export function* walk(state: TreeState, startId: NodeId): Generator<TreeNode> {
  const node = state.nodes[startId];
  if (!node) return;
  yield node;
  if (node.kind === 'dir') {
    for (const childId of node.childIds) {
      yield* walk(state, childId);
    }
  }
}

export function* walkFiles(state: TreeState, startId: NodeId): Generator<FileNode> {
  for (const n of walk(state, startId)) {
    if (n.kind === 'file' && n.dirty !== 'deleted') yield n;
  }
}

export function* walkDirs(state: TreeState, startId: NodeId): Generator<DirNode> {
  for (const n of walk(state, startId)) {
    if (n.kind === 'dir' && n.dirty !== 'deleted') yield n;
  }
}

export function* walkDirsDeepestFirst(state: TreeState, startId: NodeId): Generator<DirNode> {
  const node = state.nodes[startId];
  if (!node || node.kind !== 'dir') return;
  for (const childId of node.childIds) {
    yield* walkDirsDeepestFirst(state, childId);
  }
  if (node.dirty !== 'deleted') yield node;
}

export function getChildren(state: TreeState, id: NodeId): TreeNode[] {
  const node = state.nodes[id];
  if (!node || node.kind !== 'dir') return [];
  return node.childIds.map(cid => state.nodes[cid]!).filter(Boolean);
}

export function pathOf(state: TreeState, id: NodeId): string {
  const parts: string[] = [];
  let current: NodeId | null = id;
  while (current) {
    const node: TreeNode | undefined = state.nodes[current];
    if (!node) break;
    parts.unshift(node.name);
    current = node.parentId;
  }
  return parts.join('/');
}

export function fsPathOf(state: TreeState, id: NodeId): string | null {
  if (!state.rootFsPath) return null;
  if (id === state.rootId) return state.rootFsPath;
  const parts: string[] = [];
  let current: NodeId | null = id;
  while (current && current !== state.rootId) {
    const node: TreeNode | undefined = state.nodes[current];
    if (!node) return null;
    parts.unshift(node.name);
    current = node.parentId;
  }
  if (parts.length === 0) return state.rootFsPath;
  const sep = /^[a-zA-Z]:[\\/]/.test(state.rootFsPath) || state.rootFsPath.includes('\\') ? '\\' : '/';
  return state.rootFsPath + sep + parts.join(sep);
}

export function findByPath(state: TreeState, path: string): TreeNode | null {
  for (const node of Object.values(state.nodes)) {
    if (node.originalPath === path) return node;
  }
  return null;
}

export interface ChildCounts {
  files: number;
  dirs: number;
}

export function countDirectChildren(state: TreeState, id: NodeId): ChildCounts {
  const node = state.nodes[id];
  if (!node || node.kind !== 'dir') return { files: 0, dirs: 0 };
  let files = 0;
  let dirs = 0;
  for (const cid of node.childIds) {
    const c = state.nodes[cid];
    if (!c || c.dirty === 'deleted') continue;
    if (c.kind === 'file') files++;
    else dirs++;
  }
  return { files, dirs };
}

/** True if any node has a pending dirty flag other than `deleted`. Used to decide
 * whether external FS events can be auto-merged without trashing user edits. */
export function hasPendingChanges(state: TreeState): boolean {
  for (const id in state.nodes) {
    const d = state.nodes[id]?.dirty;
    if (d && d !== 'deleted') return true;
  }
  return false;
}
