import { describe, expect, it } from 'vitest';
import { buildTree } from '@/core/tree/build';
import { makeNodeId } from '@/core/tree/identity';
import type { FsEntry } from '@/types';

describe('buildTree', () => {
  it('constructs root + children with parent/child links', () => {
    const entries: FsEntry[] = [
      {
        path: '/tmp/proj/src',
        relPath: 'src',
        name: 'src',
        isDir: true,
        size: 0,
        modified: 0,
        ext: '',
      },
      {
        path: '/tmp/proj/src/main.ts',
        relPath: 'src/main.ts',
        name: 'main.ts',
        isDir: false,
        size: 100,
        modified: 0,
        ext: 'ts',
      },
      {
        path: '/tmp/proj/README.md',
        relPath: 'README.md',
        name: 'README.md',
        isDir: false,
        size: 20,
        modified: 0,
        ext: 'md',
      },
    ];
    const state = buildTree(entries, '/tmp/proj');
    expect(state.rootId).toBe(makeNodeId('/tmp/proj'));
    const root = state.nodes[state.rootId!] as any;
    expect(root.childIds).toHaveLength(2);
    const srcId = makeNodeId('/tmp/proj/src');
    const mainId = makeNodeId('/tmp/proj/src/main.ts');
    expect(state.nodes[mainId]!.parentId).toBe(srcId);
  });

  it('sorts children dirs-first then alpha', () => {
    const entries: FsEntry[] = [
      { path: '/r/z.txt', relPath: 'z.txt', name: 'z.txt', isDir: false, size: 0, modified: 0, ext: 'txt' },
      { path: '/r/a.txt', relPath: 'a.txt', name: 'a.txt', isDir: false, size: 0, modified: 0, ext: 'txt' },
      { path: '/r/B', relPath: 'B', name: 'B', isDir: true, size: 0, modified: 0, ext: '' },
      { path: '/r/A', relPath: 'A', name: 'A', isDir: true, size: 0, modified: 0, ext: '' },
    ];
    const state = buildTree(entries, '/r');
    const root = state.nodes[state.rootId!] as any;
    const names = root.childIds.map((id: string) => state.nodes[id]!.name);
    expect(names).toEqual(['A', 'B', 'a.txt', 'z.txt']);
  });
});

describe('makeNodeId', () => {
  it('is stable for same path', () => {
    expect(makeNodeId('/a/b/c')).toBe(makeNodeId('/a/b/c'));
  });

  it('differs for different paths', () => {
    expect(makeNodeId('/a/b/c')).not.toBe(makeNodeId('/a/b/d'));
  });

  it('normalizes backslashes', () => {
    expect(makeNodeId('C:\\foo\\bar')).toBe(makeNodeId('C:/foo/bar'));
  });
});
