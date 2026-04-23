import { describe, expect, it } from 'vitest';
import { estimateBytes } from '@/core/transaction/estimate';
import type { FileNode, Operation, TreeState } from '@/types';

function makeState(rootFsPath: string, files: Array<{ path: string; size: number }>): TreeState {
  const nodes: TreeState['nodes'] = {};
  const rootId = 'p:root';
  nodes[rootId] = {
    id: rootId,
    name: 'root',
    kind: 'dir',
    parentId: null,
    childIds: [],
    originalPath: rootFsPath,
  };
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const id = 'p:' + i;
    const fileNode: FileNode = {
      id,
      name: f.path.split(/[\\/]/).pop()!,
      kind: 'file',
      parentId: rootId,
      size: f.size,
      modified: 0,
      ext: '',
      originalPath: f.path,
    };
    nodes[id] = fileNode;
    (nodes[rootId] as any).childIds.push(id);
  }
  return { rootId, nodes, rootFsPath };
}

describe('estimateBytes', () => {
  it('returns 0 when no rootFsPath', () => {
    const state: TreeState = { rootId: null, nodes: {}, rootFsPath: null };
    expect(estimateBytes(state, [{ kind: 'mkdir', path: 'x' }])).toBe(0);
  });

  it('treats same-volume Move as zero bytes', () => {
    const state = makeState('C:\\data', [{ path: 'C:\\data\\a.txt', size: 1_000_000 }]);
    const ops: Operation[] = [{ kind: 'move', from: 'C:\\data\\a.txt', to: 'C:\\data\\b.txt' }];
    expect(estimateBytes(state, ops)).toBe(0);
  });

  it('charges sum of file sizes for cross-volume Move', () => {
    const state = makeState('C:\\data', [{ path: 'C:\\data\\a.txt', size: 500 }]);
    const ops: Operation[] = [{ kind: 'move', from: 'C:\\data\\a.txt', to: 'D:\\out\\a.txt' }];
    expect(estimateBytes(state, ops)).toBe(500);
  });

  it('charges 4KB per mkdir', () => {
    const state = makeState('C:\\data', []);
    const ops: Operation[] = [
      { kind: 'mkdir', path: 'C:\\data\\a' },
      { kind: 'mkdir', path: 'C:\\data\\b' },
    ];
    expect(estimateBytes(state, ops)).toBe(8192);
  });

  it('charges 0 for rename and delete', () => {
    const state = makeState('C:\\data', [{ path: 'C:\\data\\a.txt', size: 9999 }]);
    const ops: Operation[] = [
      { kind: 'rename', path: 'C:\\data\\a.txt', newName: 'b.txt' },
      { kind: 'delete', path: 'C:\\data\\a.txt', recursive: false },
    ];
    expect(estimateBytes(state, ops)).toBe(0);
  });
});
