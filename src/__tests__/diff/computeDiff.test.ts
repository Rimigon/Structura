import { describe, expect, it } from 'vitest';
import { computeDiff, diffFromDirtyFlags, summarize } from '@/core/diff/computeDiff';
import { applyInMemory } from '@/core/transaction/apply';
import { smallTree } from '../fixtures/trees';

describe('computeDiff', () => {
  it('detects move', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'move', from: '/tmp/proj/src/main.ts', to: '/tmp/proj/main.ts' },
    ]);
    const diff = computeDiff(smallTree, after);
    expect(diff.some(d => d.kind === 'moved')).toBe(true);
  });

  it('detects delete', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'delete', path: '/tmp/proj/README.md', recursive: false },
    ]);
    const diff = computeDiff(smallTree, after);
    expect(diff.some(d => d.kind === 'removed')).toBe(true);
  });

  it('detects new', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'mkdir', path: '/tmp/proj/newdir' },
    ]);
    const diff = computeDiff(smallTree, after);
    expect(diff.some(d => d.kind === 'added')).toBe(true);
  });

  it('summarize totals correctly', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'move', from: '/tmp/proj/src/main.ts', to: '/tmp/proj/main.ts' },
      { kind: 'delete', path: '/tmp/proj/README.md', recursive: false },
    ]);
    const diff = computeDiff(smallTree, after);
    const s = summarize(diff);
    expect(s.total).toBeGreaterThanOrEqual(2);
  });
});

describe('diffFromDirtyFlags', () => {
  it('returns entries for dirty nodes only', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'delete', path: '/tmp/proj/README.md', recursive: false },
    ]);
    const entries = diffFromDirtyFlags(after);
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe('removed');
  });
});
