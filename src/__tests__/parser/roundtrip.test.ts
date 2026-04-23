import { describe, expect, it } from 'vitest';
import {
  parseTabIndent,
  parseMarkdown,
  parseJson,
  treeToTabIndent,
  treeToMarkdown,
  treeToJson,
} from '@/core/parser';
import type { DirNode, TreeState } from '@/types';

function structure(state: TreeState, id = state.rootId): any {
  if (!id) return null;
  const node = state.nodes[id]!;
  if (node.kind === 'file') return { name: node.name, kind: 'file' };
  return {
    name: node.name,
    kind: 'dir',
    children: (node as DirNode).childIds.map(c => structure(state, c)),
  };
}

describe('parser round-trip', () => {
  it('tab-indent round-trips', () => {
    const original = [
      'proj/',
      '\tsrc/',
      '\t\tmain.ts',
      '\t\tutils/',
      '\t\t\tformat.ts',
      '\tREADME.md',
    ].join('\n');
    const state = parseTabIndent(original);
    const emitted = treeToTabIndent(state);
    const restate = parseTabIndent(emitted);
    expect(structure(restate)).toEqual(structure(state));
  });

  it('markdown round-trips', () => {
    const original = [
      '- proj/',
      '  - src/',
      '    - main.ts',
      '  - README.md',
    ].join('\n');
    const state = parseMarkdown(original);
    const emitted = treeToMarkdown(state);
    const restate = parseMarkdown(emitted);
    expect(structure(restate)).toEqual(structure(state));
  });

  it('json round-trips', () => {
    const original = parseTabIndent(
      [
        'proj/',
        '\tsrc/',
        '\t\tmain.ts',
        '\t\tutils/',
        '\t\t\tformat.ts',
        '\tREADME.md',
      ].join('\n'),
    );
    const emitted = treeToJson(original);
    const restate = parseJson(emitted);
    expect(structure(restate)).toEqual(structure(original));
  });

  it('json rejects wrong version', () => {
    expect(() => parseJson('{"version":2,"root":{"name":"x","kind":"dir"}}')).toThrow(
      /version 2/,
    );
  });

  it('json rejects file with children', () => {
    expect(() =>
      parseJson(
        '{"version":1,"root":{"name":"p","kind":"dir","children":[{"name":"a.txt","kind":"file","children":[]}]}}',
      ),
    ).toThrow(/must not have children/);
  });
});
