import { describe, expect, it } from 'vitest';
import { flatten } from '@/core/flatten/flatten';
import { DEFAULT_FLATTEN_CONFIG } from '@/types';
import type { FlattenConfig, FileNode, TreeState } from '@/types';
import { deepConflicts, nestedConflicts, smallTree } from '../fixtures/trees';

describe('flatten', () => {
  it('moves all files to target and leaves existing root files alone', () => {
    const { tx } = flatten(smallTree, smallTree.rootId!, DEFAULT_FLATTEN_CONFIG);
    const moves = tx.ops.filter(o => o.kind === 'move');
    const tos = moves.map(m => (m as any).to);
    expect(tos).toContain('/tmp/proj/main.ts');
    expect(tos).toContain('/tmp/proj/utils.ts');
    expect(tos).not.toContain('/tmp/proj/README.md');
  });

  it('resolves collisions parent-prefix first', () => {
    const { tx } = flatten(nestedConflicts, nestedConflicts.rootId!, DEFAULT_FLATTEN_CONFIG);
    const moves = tx.ops.filter(o => o.kind === 'move');
    const names = moves.map(m => (m as any).to.split('/').pop() as string).sort();
    expect(names).toContain('a-file.txt');
    expect(names).toContain('b-file.txt');
    expect(names).not.toContain('file.txt');
  });

  it('falls back to counter on double collision', () => {
    const { tx } = flatten(deepConflicts, deepConflicts.rootId!, DEFAULT_FLATTEN_CONFIG);
    const moves = tx.ops.filter(o => o.kind === 'move');
    const names = moves.map(m => (m as any).to.split('/').pop() as string).sort();
    expect(names).toContain('a-file.txt');
    expect(names.some(n => n === 'a-file-2.txt' || n === 'file.txt')).toBe(true);
  });

  it('produces cleanup ops deepest-first when configured', () => {
    const { tx } = flatten(nestedConflicts, nestedConflicts.rootId!, DEFAULT_FLATTEN_CONFIG);
    const deletes = tx.ops.filter(o => o.kind === 'delete');
    expect(deletes.length).toBe(2);
    const depths = deletes.map(d => (d as any).path.split('/').length);
    for (let i = 0; i < depths.length - 1; i++) {
      expect(depths[i]!).toBeGreaterThanOrEqual(depths[i + 1]!);
    }
  });

  it('is deterministic', () => {
    const a = flatten(nestedConflicts, nestedConflicts.rootId!, DEFAULT_FLATTEN_CONFIG);
    const b = flatten(nestedConflicts, nestedConflicts.rootId!, DEFAULT_FLATTEN_CONFIG);
    expect(a.tx.ops).toEqual(b.tx.ops);
  });

  it('skips files exceeding maxFileSizeBytes', () => {
    const state = oversizeTree();
    const cfg: FlattenConfig = { ...DEFAULT_FLATTEN_CONFIG, maxFileSizeBytes: 1024 };
    const { tx } = flatten(state, state.rootId!, cfg);
    const movedPaths = tx.ops.filter(o => o.kind === 'move').map(m => (m as any).from as string);
    expect(movedPaths).toContain('/tmp/p/sub/small.txt');
    expect(movedPaths).not.toContain('/tmp/p/sub/big.bin');
  });

  it('returns pending conflicts when strategy is ask', () => {
    const cfg: FlattenConfig = { ...DEFAULT_FLATTEN_CONFIG, conflictStrategy: 'ask' };
    const { tx, pending } = flatten(nestedConflicts, nestedConflicts.rootId!, cfg);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0]!.fileName).toBe('file.txt');
    expect(tx.ops.filter(o => o.kind === 'delete').length).toBe(0);
  });

  it('applies keep-both resolution', () => {
    const cfg: FlattenConfig = { ...DEFAULT_FLATTEN_CONFIG, conflictStrategy: 'ask' };
    const { pending } = flatten(nestedConflicts, nestedConflicts.rootId!, cfg);
    const resolutions = new Map(pending.map(p => [p.fileNodeId, { kind: 'keep-both' } as const]));
    const { tx, pending: p2 } = flatten(nestedConflicts, nestedConflicts.rootId!, cfg, resolutions);
    expect(p2).toHaveLength(0);
    const names = tx.ops
      .filter(o => o.kind === 'move')
      .map(m => (m as any).to.split('/').pop());
    expect(names.some((n: string) => n.startsWith('a-') || n.startsWith('b-'))).toBe(true);
  });

  it('skip resolution drops the op entirely', () => {
    const cfg: FlattenConfig = { ...DEFAULT_FLATTEN_CONFIG, conflictStrategy: 'ask' };
    const { pending } = flatten(nestedConflicts, nestedConflicts.rootId!, cfg);
    const resolutions = new Map(pending.map(p => [p.fileNodeId, { kind: 'skip' } as const]));
    const { tx } = flatten(nestedConflicts, nestedConflicts.rootId!, cfg, resolutions);
    const moveCount = tx.ops.filter(o => o.kind === 'move').length;
    expect(moveCount).toBeLessThan(pending.length + 1);
  });
});

function oversizeTree(): TreeState {
  const rootId = 'p:root';
  const subId = 'p:sub';
  const smallId = 'p:small';
  const bigId = 'p:big';
  const nodes = {
    [rootId]: {
      id: rootId,
      name: 'p',
      kind: 'dir' as const,
      parentId: null,
      childIds: [subId],
      originalPath: '/tmp/p',
      expanded: true,
    },
    [subId]: {
      id: subId,
      name: 'sub',
      kind: 'dir' as const,
      parentId: rootId,
      childIds: [smallId, bigId],
      originalPath: '/tmp/p/sub',
      expanded: true,
    },
    [smallId]: {
      id: smallId,
      name: 'small.txt',
      kind: 'file' as const,
      parentId: subId,
      size: 100,
      modified: 0,
      ext: 'txt',
      originalPath: '/tmp/p/sub/small.txt',
    } satisfies FileNode,
    [bigId]: {
      id: bigId,
      name: 'big.bin',
      kind: 'file' as const,
      parentId: subId,
      size: 2_000_000_000,
      modified: 0,
      ext: 'bin',
      originalPath: '/tmp/p/sub/big.bin',
    } satisfies FileNode,
  };
  return { rootId, nodes, rootFsPath: '/tmp/p' };
}
