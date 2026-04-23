import type { DirNode, Operation, TreeNode, TreeState } from '@/types';
import { makeNewNodeId } from '../tree/identity';
import { basename, dirname } from '../tree/paths';

export function applyInMemory(state: TreeState, ops: Operation[]): TreeState {
  let next: TreeState = {
    rootId: state.rootId,
    nodes: { ...state.nodes },
    rootFsPath: state.rootFsPath,
  };
  for (const op of ops) {
    next = applyOne(next, op);
  }
  return next;
}

function applyOne(state: TreeState, op: Operation): TreeState {
  switch (op.kind) {
    case 'move':
      return doMove(state, op.from, op.to);
    case 'rename':
      return doRename(state, op.path, op.newName);
    case 'delete':
      return doDelete(state, op.path);
    case 'mkdir':
      return doMkdir(state, op.path);
    case 'touch':
      return state;
  }
}

function findNodeByPath(state: TreeState, path: string): TreeNode | null {
  for (const n of Object.values(state.nodes)) {
    if (n.originalPath === path) return n;
  }
  return null;
}

function doMove(state: TreeState, from: string, to: string): TreeState {
  const node = findNodeByPath(state, from);
  if (!node) return state;
  const targetParentPath = dirname(to);
  const targetParent = findNodeByPath(state, targetParentPath);
  if (!targetParent || targetParent.kind !== 'dir') return state;
  const oldParent = node.parentId ? state.nodes[node.parentId] : null;
  if (!oldParent || oldParent.kind !== 'dir') return state;
  const newName = basename(to);
  const updatedNodes = { ...state.nodes };
  updatedNodes[oldParent.id] = {
    ...oldParent,
    childIds: (oldParent as DirNode).childIds.filter(id => id !== node.id),
  };
  updatedNodes[targetParent.id] = {
    ...targetParent,
    childIds: [...(targetParent as DirNode).childIds, node.id],
  };
  updatedNodes[node.id] = {
    ...node,
    name: newName,
    parentId: targetParent.id,
    dirty: node.dirty ?? (oldParent.id !== targetParent.id ? 'moved' : 'renamed'),
  };
  return { ...state, nodes: updatedNodes };
}

function doRename(state: TreeState, path: string, newName: string): TreeState {
  const node = findNodeByPath(state, path);
  if (!node) return state;
  const updatedNodes = { ...state.nodes };
  updatedNodes[node.id] = {
    ...node,
    name: newName,
    dirty: node.dirty ?? 'renamed',
  };
  return { ...state, nodes: updatedNodes };
}

function doDelete(state: TreeState, path: string): TreeState {
  const node = findNodeByPath(state, path);
  if (!node) return state;
  const updatedNodes = { ...state.nodes };
  updatedNodes[node.id] = { ...node, dirty: 'deleted' };
  return { ...state, nodes: updatedNodes };
}

function doMkdir(state: TreeState, path: string): TreeState {
  if (findNodeByPath(state, path)) return state;
  const parentPath = dirname(path);
  const parent = findNodeByPath(state, parentPath);
  if (!parent || parent.kind !== 'dir') return state;
  const id = makeNewNodeId(path);
  const name = basename(path);
  const newDir: DirNode = {
    id,
    name,
    kind: 'dir',
    parentId: parent.id,
    childIds: [],
    originalPath: path,
    expanded: false,
    dirty: 'new',
  };
  const updatedNodes = { ...state.nodes };
  updatedNodes[id] = newDir;
  updatedNodes[parent.id] = {
    ...parent,
    childIds: [...(parent as DirNode).childIds, id],
  };
  return { ...state, nodes: updatedNodes };
}
