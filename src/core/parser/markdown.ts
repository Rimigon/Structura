import type { TreeState } from '@/types';
import { ParserError, buildFromLines } from './tabIndent';
import { isValidName } from '../tree/paths';

const BULLET_RE = /^(\s*)([-*+])\s+(.+?)\s*$/;

type Line = { raw: string; depth: number; name: string; isDir: boolean; lineNo: number };

export function parseMarkdown(text: string): TreeState {
  const rawLines = text.split(/\r?\n/);
  const bulletMatches: { match: RegExpMatchArray; lineNo: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const m = rawLines[i]!.match(BULLET_RE);
    if (m) bulletMatches.push({ match: m, lineNo: i + 1 });
  }

  if (bulletMatches.length === 0) {
    throw new ParserError('no bullet lines found', 1);
  }

  const indentWidth = detectBulletIndent(bulletMatches);
  const lines: Line[] = bulletMatches.map(({ match, lineNo }) => {
    const leading = match[1]!;
    if (leading.includes('\t')) {
      throw new ParserError('tabs in markdown indent (use spaces)', lineNo);
    }
    if (leading.length % indentWidth !== 0) {
      throw new ParserError(
        `indentation not a multiple of ${indentWidth} spaces`,
        lineNo,
      );
    }
    const depth = leading.length / indentWidth;
    const body = stripBackticks(match[3]!).trim();
    const isDir = body.endsWith('/');
    const name = isDir ? body.slice(0, -1) : body;
    if (!isValidName(name)) {
      throw new ParserError(`invalid name "${name}"`, lineNo);
    }
    return { raw: match[0]!, depth, name, isDir, lineNo };
  });

  return buildFromLines(lines);
}

function detectBulletIndent(matches: { match: RegExpMatchArray; lineNo: number }[]): number {
  for (const { match } of matches) {
    const leading = match[1]!;
    if (leading.length === 0) continue;
    if (leading.includes('\t')) continue;
    if (leading.length === 2) return 2;
    if (leading.length === 4) return 4;
  }
  return 2;
}

function stripBackticks(s: string): string {
  return s.replace(/`/g, '');
}
