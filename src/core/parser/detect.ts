export type ParserFormat = 'tab' | 'markdown' | 'json';

const BULLET_RE = /^\s*[-*+]\s/;

export function detectFormat(text: string): ParserFormat {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  const lines = text
    .split('\n')
    .filter(l => l.trim().length > 0)
    .slice(0, 20);
  if (lines.length === 0) return 'tab';
  const bullets = lines.filter(l => BULLET_RE.test(l)).length;
  return bullets / lines.length > 0.5 ? 'markdown' : 'tab';
}
