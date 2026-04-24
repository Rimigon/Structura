import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type {
  DirNode,
  FileNode,
  FsEntry,
  NodeId,
  Operation,
  ScanOptions,
  Transaction,
  TreeNode,
  TreeState,
  TxResult,
} from '@/types';
import { DEFAULT_SCAN_OPTIONS } from '@/types';
import { buildTree, compareNodes } from '@/core/tree/build';
import { makeNewNodeId } from '@/core/tree/identity';
import { applyInMemory } from '@/core/transaction/apply';
import { invertTxResult } from '@/core/transaction/invert';
import { applyTransaction, scanDirectory } from '@/lib/tauri';
import { useTxHistoryStore } from './txHistoryStore';

interface TreeActions {
  loadFromEntries(entries: FsEntry[], rootFsPath: string): void;
  scanRoot(path: string, opts?: ScanOptions): Promise<void>;
  toggleExpanded(id: NodeId): void;
  renameNode(id: NodeId, newName: string): void;
  deleteNode(id: NodeId): void;
  createNode(parentId: NodeId, kind: 'file' | 'dir', name: string): NodeId | null;
  duplicateNodes(sourceIds: NodeId[], targetParentId: NodeId): NodeId[];
  indentNode(id: NodeId): void;
  outdentNode(id: NodeId): void;
  moveNode(id: NodeId, newParentId: NodeId, beforeId?: NodeId | null): void;
  applyOps(ops: Operation[]): void;
  applyToDisk(tx: Transaction): Promise<TxResult>;
  resetDirty(): void;
  clear(): void;
}

type TreeStore = TreeState & TreeActions & { loading: boolean; error: string | null };

export const useTreeStore = create<TreeStore>()(
  persist(
    temporal(
      (set, get) => ({
      rootId: null,
      nodes: {},
      rootFsPath: null,
      loading: false,
      error: null,

      loadFromEntries: (entries, rootFsPath) => {
        const { rootId, nodes } = buildTree(entries, rootFsPath);
        set({ rootId, nodes, rootFsPath, error: null });
      },

      scanRoot: async (path, opts = DEFAULT_SCAN_OPTIONS) => {
        set({ loading: true, error: null });
        try {
          const entries = await scanDirectory(path, opts);
          get().loadFromEntries(entries, path);
        } catch (e) {
          set({ error: (e as Error).message ?? String(e) });
        } finally {
          set({ loading: false });
        }
      },

      toggleExpanded: id => {
        set(state => {
          const node = state.nodes[id];
          if (!node || node.kind !== 'dir') return state;
          return {
            ...state,
            nodes: { ...state.nodes, [id]: { ...node, expanded: !node.expanded } },
          };
        });
      },

      renameNode: (id, newName) => {
        set(state => {
          const node = state.nodes[id];
          if (!node) return state;
          const next: typeof node = {
            ...node,
            name: newName,
            dirty:
              node.dirty === 'new'
                ? 'new'
                : node.originalPath
                  ? node.dirty === 'moved'
                    ? 'moved'
                    : 'renamed'
                  : 'new',
          };
          const nodes = { ...state.nodes, [id]: next };
          const parent = node.parentId ? nodes[node.parentId] : null;
          if (parent && parent.kind === 'dir') {
            const reordered = [...parent.childIds].sort((a, b) =>
              compareNodes(nodes[a]!, nodes[b]!),
            );
            nodes[parent.id] = { ...parent, childIds: reordered };
          }
          return { ...state, nodes };
        });
      },

      deleteNode: id => {
        set(state => {
          const node = state.nodes[id];
          if (!node) return state;
          return {
            ...state,
            nodes: { ...state.nodes, [id]: { ...node, dirty: 'deleted' } },
          };
        });
      },

      createNode: (parentId, kind, name) => {
        const state = get();
        const parent = state.nodes[parentId];
        if (!parent || parent.kind !== 'dir') return null;
        const id = makeNewNodeId(`${parent.id}:${name}:${Date.now()}`);
        const newNode =
          kind === 'dir'
            ? ({
                id,
                name,
                kind: 'dir',
                parentId,
                childIds: [],
                expanded: true,
                dirty: 'new' as const,
              } satisfies DirNode)
            : {
                id,
                name,
                kind: 'file' as const,
                parentId,
                size: 0,
                modified: 0,
                ext: extOf(name),
                dirty: 'new' as const,
              };
        set(s => {
          const nodes = { ...s.nodes, [id]: newNode };
          const updatedParent: DirNode = {
            ...(parent as DirNode),
            childIds: [id, ...(parent as DirNode).childIds],
            expanded: true,
          };
          nodes[parent.id] = updatedParent;
          return { ...s, nodes };
        });
        return id;
      },

      duplicateNodes: (sourceIds, targetParentId) => {
        const state = get();
        const target = state.nodes[targetParentId];
        if (!target || target.kind !== 'dir') return [];
        const sources = sourceIds
          .map(id => state.nodes[id])
          .filter((n): n is TreeNode => !!n && !!n.originalPath);
        if (sources.length === 0) return [];

        const takenNames = new Set<string>(
          (target as DirNode).childIds
            .map(cid => state.nodes[cid]?.name)
            .filter((s): s is string => !!s),
        );

        const createdTopIds: NodeId[] = [];
        set(s => {
          const nodes = { ...s.nodes };
          for (const src of sources) {
            const baseName = uniqueName(src.name, takenNames);
            takenNames.add(baseName);
            const topId = cloneSubtree(
              src,
              state.nodes,
              nodes,
              targetParentId,
              baseName,
              true,
            );
            createdTopIds.push(topId);
          }
          const parent = nodes[targetParentId] as DirNode;
          nodes[targetParentId] = {
            ...parent,
            childIds: [...createdTopIds, ...parent.childIds],
            expanded: true,
          };
          return { ...s, nodes };
        });
        return createdTopIds;
      },

      indentNode: id => {
        set(state => {
          const node = state.nodes[id];
          if (!node || !node.parentId) return state;
          const parent = state.nodes[node.parentId];
          if (!parent || parent.kind !== 'dir') return state;
          const idx = parent.childIds.indexOf(id);
          if (idx <= 0) return state;
          const prev = state.nodes[parent.childIds[idx - 1]!];
          if (!prev || prev.kind !== 'dir') return state;
          return relocate(state, id, prev.id, null);
        });
      },

      outdentNode: id => {
        set(state => {
          const node = state.nodes[id];
          if (!node || !node.parentId) return state;
          const parent = state.nodes[node.parentId];
          if (!parent || !parent.parentId) return state;
          const grand = state.nodes[parent.parentId];
          if (!grand || grand.kind !== 'dir') return state;
          const parentIdx = grand.childIds.indexOf(parent.id);
          const anchorId = grand.childIds[parentIdx + 1] ?? null;
          return relocate(state, id, grand.id, anchorId);
        });
      },

      moveNode: (id, newParentId, beforeId = null) => {
        set(state => relocate(state, id, newParentId, beforeId));
      },

      applyOps: ops => {
        set(state => applyInMemory(state, ops));
      },

      applyToDisk: async tx => {
        const result = await applyTransaction(tx);
        const succeeded = result.results.filter(r => r.status === 'ok').map(r => r.op);
        const inverseOps = invertTxResult(result.results);
        if (succeeded.length > 0) {
          useTxHistoryStore.getState().push({
            txId: tx.id,
            label: tx.label,
            timestamp: result.completedAt,
            rootFsPath: tx.rootFsPath,
            ops: succeeded,
            inverseOps,
          });
          await get().scanRoot(tx.rootFsPath);
        }
        return result;
      },

      resetDirty: () => {
        set(state => {
          const nodes: Record<NodeId, TreeState['nodes'][NodeId]> = {};
          for (const [id, n] of Object.entries(state.nodes)) {
            if (n.dirty === 'deleted') continue;
            nodes[id] = { ...n, dirty: undefined };
          }
          for (const n of Object.values(nodes)) {
            if (n.kind === 'dir') {
              n.childIds = n.childIds.filter(cid => nodes[cid]);
            }
          }
          return { ...state, nodes };
        });
      },

      clear: () => set({ rootId: null, nodes: {}, rootFsPath: null, error: null }),
    }),
      {
        limit: 30,
        partialize: state => {
          const { nodes, rootId, rootFsPath } = state;
          const cleaned: Record<NodeId, TreeState['nodes'][NodeId]> = {};
          for (const [id, n] of Object.entries(nodes)) {
            cleaned[id] = n.kind === 'dir' ? { ...n, expanded: undefined } : n;
          }
          return { nodes: cleaned, rootId, rootFsPath } as Partial<TreeStore>;
        },
      },
    ),
    {
      name: 'structura-tree',
      version: 1,
      partialize: state => ({ rootFsPath: state.rootFsPath }) as Partial<TreeStore>,
    },
  ),
);

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function uniqueName(original: string, taken: Set<string>): string {
  if (!taken.has(original)) return original;
  const { base, ext } = splitExt(original);
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

function cloneSubtree(
  src: TreeNode,
  srcNodes: Record<NodeId, TreeNode>,
  dstNodes: Record<NodeId, TreeNode>,
  newParentId: NodeId,
  newName: string,
  isTop: boolean,
): NodeId {
  const newId = makeNewNodeId(`copy:${src.id}:${newParentId}:${Date.now()}:${Math.random()}`);
  if (src.kind === 'dir') {
    const children: NodeId[] = [];
    const childTaken = new Set<string>();
    for (const cid of src.childIds) {
      const child = srcNodes[cid];
      if (!child) continue;
      const name = uniqueName(child.name, childTaken);
      childTaken.add(name);
      const childId = cloneSubtree(child, srcNodes, dstNodes, newId, name, false);
      children.push(childId);
    }
    const clone: DirNode = {
      id: newId,
      name: newName,
      kind: 'dir',
      parentId: newParentId,
      childIds: children,
      expanded: isTop ? true : src.expanded,
      dirty: 'new',
      copiedFrom: isTop ? src.originalPath : undefined,
    };
    dstNodes[newId] = clone;
  } else {
    const clone: FileNode = {
      id: newId,
      name: newName,
      kind: 'file',
      parentId: newParentId,
      size: src.size,
      modified: src.modified,
      ext: src.ext,
      dirty: 'new',
      copiedFrom: isTop ? src.originalPath : undefined,
    };
    dstNodes[newId] = clone;
  }
  return newId;
}

function relocate(
  state: TreeStore,
  id: NodeId,
  newParentId: NodeId,
  beforeId: NodeId | null,
): TreeStore {
  const node = state.nodes[id];
  if (!node || !node.parentId || node.parentId === newParentId && beforeId === null && false) {
    return state;
  }
  const oldParent = node.parentId ? state.nodes[node.parentId] : null;
  const newParent = state.nodes[newParentId];
  if (!oldParent || oldParent.kind !== 'dir') return state;
  if (!newParent || newParent.kind !== 'dir') return state;
  if (wouldCreateCycle(state, id, newParentId)) return state;

  const nodes = { ...state.nodes };

  const oldChildIds = (oldParent as DirNode).childIds.filter(c => c !== id);
  nodes[oldParent.id] = { ...(oldParent as DirNode), childIds: oldChildIds };

  let insertChildren: NodeId[];
  if (newParent.id === oldParent.id) {
    insertChildren = oldChildIds;
  } else {
    insertChildren = [...(newParent as DirNode).childIds];
  }
  const insertIdx =
    beforeId === null ? insertChildren.length : Math.max(0, insertChildren.indexOf(beforeId));
  insertChildren = [
    ...insertChildren.slice(0, insertIdx),
    id,
    ...insertChildren.slice(insertIdx),
  ];
  nodes[newParent.id] = { ...(newParent as DirNode), childIds: insertChildren };

  const nextDirty =
    node.dirty === 'new' ? ('new' as const) : node.originalPath ? ('moved' as const) : ('new' as const);
  nodes[id] = { ...node, parentId: newParent.id, dirty: nextDirty };

  return { ...state, nodes };
}

function wouldCreateCycle(state: TreeStore, id: NodeId, newParentId: NodeId): boolean {
  if (id === newParentId) return true;
  let cur: NodeId | null = newParentId;
  while (cur) {
    if (cur === id) return true;
    const node: TreeState['nodes'][NodeId] | undefined = state.nodes[cur];
    cur = node?.parentId ?? null;
  }
  return false;
}

export const useTreeHistory = () => useTreeStore.temporal;
