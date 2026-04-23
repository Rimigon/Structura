import { describe, expect, it } from 'vitest';
import { matchGlob } from '@/core/search/glob';
import { findMatchingIds } from '@/core/search/filterTree';
import type { TreeState, FileNode, DirNode } from '@/types';

describe('matchGlob', () => {
  it('matches * within segment', () => {
    expect(matchGlob('*.log', 'app.log')).toBe(true);
    expect(matchGlob('*.log', 'app.txt')).toBe(false);
  });

  it('matches ? single char', () => {
    expect(matchGlob('file?.ts', 'file1.ts')).toBe(true);
    expect(matchGlob('file?.ts', 'file12.ts')).toBe(false);
  });

  it('matches character class', () => {
    expect(matchGlob('[abc].txt', 'a.txt')).toBe(true);
    expect(matchGlob('[abc].txt', 'd.txt')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(matchGlob('*.LOG', 'app.log')).toBe(true);
  });

  it('** crosses separators', () => {
    expect(matchGlob('src/**/*.ts', 'src/utils/file.ts')).toBe(true);
    expect(matchGlob('src/**', 'src/a/b/c')).toBe(true);
  });

  it('escapes regex metacharacters', () => {
    expect(matchGlob('a.b', 'a.b')).toBe(true);
    expect(matchGlob('a.b', 'axb')).toBe(false);
  });
});

describe('findMatchingIds', () => {
  const rootId = 'p:r';
  const aId = 'p:a';
  const bId = 'p:b';
  const state: TreeState = {
    rootId,
    rootFsPath: '/root',
    nodes: {
      [rootId]: {
        id: rootId,
        name: 'root',
        kind: 'dir',
        parentId: null,
        childIds: [aId, bId],
        originalPath: '/root',
      } satisfies DirNode,
      [aId]: {
        id: aId,
        name: 'app.log',
        kind: 'file',
        parentId: rootId,
        size: 0,
        modified: 0,
        ext: 'log',
        originalPath: '/root/app.log',
      } satisfies FileNode,
      [bId]: {
        id: bId,
        name: 'readme.md',
        kind: 'file',
        parentId: rootId,
        size: 0,
        modified: 0,
        ext: 'md',
        originalPath: '/root/readme.md',
      } satisfies FileNode,
    },
  };

  it('finds files by glob on name', () => {
    expect(findMatchingIds(state, { pattern: '*.log' })).toEqual([aId]);
  });

  it('supports plain substring match', () => {
    expect(findMatchingIds(state, { pattern: 'read' })).toEqual([bId]);
  });

  it('filters by kind', () => {
    expect(findMatchingIds(state, { pattern: 'root', kind: 'dir' })).toEqual([rootId]);
    expect(findMatchingIds(state, { pattern: 'root', kind: 'file' })).toEqual([]);
  });
});
