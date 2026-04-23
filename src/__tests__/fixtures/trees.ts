import type { DirNode, FileNode, TreeNode, TreeState } from '@/types';

interface Spec {
  name: string;
  children?: Spec[];
  file?: boolean;
}

let counter = 0;
function nextId(prefix: string): string {
  return `${prefix}:${counter++}`;
}

function buildSpec(spec: Spec, parentId: string | null, absPath: string, nodes: Record<string, TreeNode>): string {
  counter++;
  const id = nextId('n');
  if (spec.file) {
    const file: FileNode = {
      id,
      name: spec.name,
      kind: 'file',
      parentId,
      size: 100,
      modified: 0,
      ext: extOf(spec.name),
      originalPath: absPath,
    };
    nodes[id] = file;
    return id;
  } else {
    const childIds = (spec.children ?? []).map(c =>
      buildSpec(c, id, `${absPath}/${c.name}`, nodes),
    );
    const dir: DirNode = {
      id,
      name: spec.name,
      kind: 'dir',
      parentId,
      childIds,
      originalPath: absPath,
      expanded: true,
    };
    nodes[id] = dir;
    return id;
  }
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function buildFixture(root: Spec, rootFsPath: string): TreeState {
  counter = 0;
  const nodes: Record<string, TreeNode> = {};
  const rootId = buildSpec(root, null, rootFsPath, nodes);
  return { rootId, nodes, rootFsPath };
}

export const smallTree: TreeState = buildFixture(
  {
    name: 'proj',
    children: [
      {
        name: 'src',
        children: [
          { name: 'main.ts', file: true },
          { name: 'utils.ts', file: true },
        ],
      },
      { name: 'README.md', file: true },
    ],
  },
  '/tmp/proj',
);

export const nestedConflicts: TreeState = buildFixture(
  {
    name: 'proj',
    children: [
      {
        name: 'a',
        children: [{ name: 'file.txt', file: true }],
      },
      {
        name: 'b',
        children: [{ name: 'file.txt', file: true }],
      },
      { name: 'file.txt', file: true },
    ],
  },
  '/tmp/proj',
);

export const deepConflicts: TreeState = buildFixture(
  {
    name: 'proj',
    children: [
      {
        name: 'a',
        children: [
          { name: 'file.txt', file: true },
          { name: 'a-file.txt', file: true },
        ],
      },
    ],
  },
  '/tmp/proj',
);
