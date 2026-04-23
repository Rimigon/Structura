import type { DirNode, FileNode, FsEntry, NodeId, TreeNode, TreeState } from '@/types';
import { makeNodeId } from './identity';
import { dirname, normalize } from './paths';

export function emptyTree(): TreeState {
  return { rootId: null, nodes: {}, rootFsPath: null };
}

export function buildTree(entries: FsEntry[], rootFsPath: string): TreeState {
  const rootPath = normalize(rootFsPath);
  const rootId = makeNodeId(rootPath);
  const nodes: Record<NodeId, TreeNode> = {};

  nodes[rootId] = {
    id: rootId,
    name: basenameOr(rootPath, rootPath),
    kind: 'dir',
    parentId: null,
    childIds: [],
    originalPath: rootPath,
    expanded: true,
  };

  const sorted = [...entries].sort(
    (a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path),
  );

  for (const entry of sorted) {
    const absPath = normalize(entry.path);
    if (absPath === rootPath) continue;
    const parentPath = dirname(absPath);
    const parentId = makeNodeId(parentPath);
    if (!nodes[parentId]) continue;
    const id = makeNodeId(absPath);
    if (nodes[id]) continue;
    if (entry.isDir) {
      const dir: DirNode = {
        id,
        name: entry.name,
        kind: 'dir',
        parentId,
        childIds: [],
        originalPath: absPath,
        expanded: false,
      };
      nodes[id] = dir;
    } else {
      const file: FileNode = {
        id,
        name: entry.name,
        kind: 'file',
        parentId,
        size: entry.size,
        modified: entry.modified,
        ext: entry.ext,
        originalPath: absPath,
      };
      nodes[id] = file;
    }
    (nodes[parentId] as DirNode).childIds.push(id);
  }

  for (const node of Object.values(nodes)) {
    if (node.kind === 'dir') {
      node.childIds.sort((a, b) => compareNodes(nodes[a]!, nodes[b]!));
    }
  }

  return { rootId, nodes, rootFsPath: rootPath };
}

export function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function basenameOr(path: string, fallback: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (idx < 0) return path || fallback;
  const base = path.slice(idx + 1);
  return base.length > 0 ? base : path;
}
