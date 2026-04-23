import { describe, expect, it } from 'vitest';
import { ParserError, parseTabIndent } from '@/core/parser/tabIndent';

describe('parseTabIndent', () => {
  it('parses a simple tree', () => {
    const text = [
      'proj/',
      '\tsrc/',
      '\t\tmain.ts',
      '\tREADME.md',
    ].join('\n');
    const state = parseTabIndent(text);
    const root = state.nodes[state.rootId!]!;
    expect(root.kind).toBe('dir');
    expect(root.name).toBe('proj');
    expect((root as any).childIds).toHaveLength(2);
  });

  it('supports 2-space indent', () => {
    const text = ['proj/', '  src/', '    main.ts'].join('\n');
    const state = parseTabIndent(text);
    expect(state.rootId).toBeTruthy();
    const root = state.nodes[state.rootId!]!;
    expect((root as any).childIds).toHaveLength(1);
  });

  it('supports 4-space indent', () => {
    const text = ['proj/', '    src/', '        main.ts'].join('\n');
    const state = parseTabIndent(text);
    const root = state.nodes[state.rootId!]!;
    expect((root as any).childIds).toHaveLength(1);
  });

  it('rejects mixed tabs and spaces', () => {
    const text = ['proj/', '\t src/'].join('\n');
    expect(() => parseTabIndent(text)).toThrow(ParserError);
  });

  it('rejects invalid names', () => {
    const text = ['proj/', '\t../bad'].join('\n');
    expect(() => parseTabIndent(text)).toThrow(ParserError);
  });

  it('strips comments', () => {
    const text = ['proj/ # the root', '\tmain.ts # entry'].join('\n');
    const state = parseTabIndent(text);
    const root = state.nodes[state.rootId!]!;
    expect(root.name).toBe('proj');
  });

  it('ignores blank lines', () => {
    const text = ['proj/', '', '\tmain.ts', ''].join('\n');
    const state = parseTabIndent(text);
    const root = state.nodes[state.rootId!]!;
    expect((root as any).childIds).toHaveLength(1);
  });

  it('requires root to be a directory', () => {
    expect(() => parseTabIndent('notadir')).toThrow(ParserError);
  });

  it('throws on empty input', () => {
    expect(() => parseTabIndent('')).toThrow(ParserError);
  });

  it('throws on unexpected indent jump', () => {
    const text = ['proj/', '\t\tdeep.ts'].join('\n');
    expect(() => parseTabIndent(text)).toThrow(ParserError);
  });
});
