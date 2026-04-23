import { describe, expect, it } from 'vitest';
import { ParserError } from '@/core/parser/tabIndent';
import { parseMarkdown } from '@/core/parser/markdown';

describe('parseMarkdown', () => {
  it('parses bullet-only markdown', () => {
    const text = [
      '- proj/',
      '  - src/',
      '    - main.ts',
      '  - README.md',
    ].join('\n');
    const state = parseMarkdown(text);
    const root = state.nodes[state.rootId!]!;
    expect(root.name).toBe('proj');
    expect((root as any).childIds).toHaveLength(2);
  });

  it('strips backticks', () => {
    const text = ['- `proj/`', '  - `main.ts`'].join('\n');
    const state = parseMarkdown(text);
    const root = state.nodes[state.rootId!]!;
    expect(root.name).toBe('proj');
  });

  it('ignores headings and prose', () => {
    const text = [
      '# My Project',
      '',
      'Here is the structure:',
      '',
      '- proj/',
      '  - main.ts',
      '',
      'Thanks for reading.',
    ].join('\n');
    const state = parseMarkdown(text);
    expect(state.rootId).toBeTruthy();
    expect(state.nodes[state.rootId!]!.name).toBe('proj');
  });

  it('supports star bullets', () => {
    const text = ['* proj/', '  * main.ts'].join('\n');
    const state = parseMarkdown(text);
    expect(state.nodes[state.rootId!]!.name).toBe('proj');
  });

  it('rejects tab indent', () => {
    const text = ['- proj/', '\t- main.ts'].join('\n');
    expect(() => parseMarkdown(text)).toThrow(ParserError);
  });

  it('throws when no bullets present', () => {
    expect(() => parseMarkdown('# just a title')).toThrow(ParserError);
  });
});
