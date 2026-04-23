import type { TreeState } from '@/types';
import { detectFormat, type ParserFormat } from './detect';
import { parseTabIndent } from './tabIndent';
import { parseMarkdown } from './markdown';
import { parseJson } from './json';

export { parseTabIndent, ParserError } from './tabIndent';
export { parseMarkdown } from './markdown';
export { parseJson, treeToJson } from './json';
export { treeToTabIndent, treeToMarkdown } from './export';
export { detectFormat } from './detect';
export type { ParserFormat } from './detect';

export function parseText(text: string, format: ParserFormat | 'auto' = 'auto'): TreeState {
  const actual = format === 'auto' ? detectFormat(text) : format;
  if (actual === 'json') return parseJson(text);
  if (actual === 'markdown') return parseMarkdown(text);
  return parseTabIndent(text);
}
