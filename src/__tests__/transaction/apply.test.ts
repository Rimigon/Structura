import { describe, expect, it } from 'vitest';
import { applyInMemory } from '@/core/transaction/apply';
import { smallTree } from '../fixtures/trees';

describe('applyInMemory', () => {
  it('applies a move', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'move', from: '/tmp/proj/src/main.ts', to: '/tmp/proj/main.ts' },
    ]);
    const root = after.nodes[after.rootId!] as any;
    const rootChildNames = root.childIds.map((id: string) => after.nodes[id]!.name);
    expect(rootChildNames).toContain('main.ts');
  });

  it('applies a rename', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'rename', path: '/tmp/proj/README.md', newName: 'README.txt' },
    ]);
    const renamed = Object.values(after.nodes).find(n => n.originalPath === '/tmp/proj/README.md');
    expect(renamed).toBeTruthy();
    expect(renamed!.name).toBe('README.txt');
    expect(renamed!.dirty).toBe('renamed');
  });

  it('marks deletes via dirty flag', () => {
    const after = applyInMemory(smallTree, [
      { kind: 'delete', path: '/tmp/proj/README.md', recursive: false },
    ]);
    const node = Object.values(after.nodes).find(n => n.originalPath === '/tmp/proj/README.md');
    expect(node!.dirty).toBe('deleted');
  });
});
