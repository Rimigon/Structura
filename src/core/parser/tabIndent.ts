import type { DirNode, FileNode, NodeId, TreeNode, TreeState } from '@/types';
import { makeNewNodeId } from '../tree/identity';
import { isValidName } from '../tree/paths';

type Line = { raw: string; depth: number; name: string; isDir: boolean; lineNo: number };

export class ParserError extends Error {
  constructor(
    message: string,
    public readonly lineNo: number,
  ) {
    super(`Line ${lineNo}: ${message}`);
  }
}

export function parseTabIndent(text: string): TreeState {
  const raw = text.split(/\r?\n/);
  const cleaned = stripComments(raw);
  const nonBlank = cleaned
    .map((l, i) => ({ line: l, lineNo: i + 1 }))
    .filter(({ line }) => line.trim().length > 0);

  if (nonBlank.length === 0) throw new ParserError('empty input', 1);

  const indentUnit = detectIndent(nonBlank);
  const lines: Line[] = nonBlank.map(({ line, lineNo }) => parseLine(line, lineNo, indentUnit));
  return buildFromLines(lines);
}

function stripComments(lines: string[]): string[] {
  return lines.map(l => {
    const hashIdx = findUnquotedHash(l);
    return hashIdx >= 0 ? l.slice(0, hashIdx).trimEnd() : l;
  });
}

function findUnquotedHash(line: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '#') return i;
  }
  return -1;
}

type IndentUnit = { kind: 'tab' } | { kind: 'space'; width: 2 | 4 };

function detectIndent(lines: { line: string; lineNo: number }[]): IndentUnit {
  for (const { line, lineNo } of lines) {
    if (line.length === 0) continue;
    const leading = line.match(/^(\s*)/)![1]!;
    if (leading.length === 0) continue;
    if (leading.startsWith('\t')) {
      if (leading.includes(' ')) {
        throw new ParserError('mixed tabs and spaces in indentation', lineNo);
      }
      return { kind: 'tab' };
    }
    if (leading.includes('\t')) {
      throw new ParserError('mixed tabs and spaces in indentation', lineNo);
    }
    if (leading.length === 2) return { kind: 'space', width: 2 };
    if (leading.length === 4) return { kind: 'space', width: 4 };
    throw new ParserError(
      `ambiguous indent width ${leading.length} (expected 2 or 4 spaces, or 1 tab)`,
      lineNo,
    );
  }
  return { kind: 'tab' };
}

function parseLine(line: string, lineNo: number, unit: IndentUnit): Line {
  const leading = line.match(/^(\s*)/)![1]!;
  const body = line.slice(leading.length).trim();
  let depth: number;
  if (unit.kind === 'tab') {
    if (leading.includes(' ')) {
      throw new ParserError('mixed tabs and spaces in indentation', lineNo);
    }
    depth = leading.length;
  } else {
    if (leading.includes('\t')) {
      throw new ParserError('mixed tabs and spaces in indentation', lineNo);
    }
    if (leading.length % unit.width !== 0) {
      throw new ParserError(`indentation not a multiple of ${unit.width} spaces`, lineNo);
    }
    depth = leading.length / unit.width;
  }
  const isDir = body.endsWith('/');
  const name = isDir ? body.slice(0, -1) : body;
  if (!isValidName(name)) {
    throw new ParserError(`invalid name "${name}"`, lineNo);
  }
  return { raw: line, depth, name, isDir, lineNo };
}

export function buildFromLines(lines: Line[]): TreeState {
  const first = lines[0]!;
  if (first.depth !== 0) {
    throw new ParserError('first line must not be indented', first.lineNo);
  }
  const rootId = makeNewNodeId(first.name + ':root');
  const nodes: Record<NodeId, TreeNode> = {};
  const root: DirNode = {
    id: rootId,
    name: first.name,
    kind: 'dir',
    parentId: null,
    childIds: [],
    expanded: true,
    dirty: 'new',
  };
  if (!first.isDir) {
    throw new ParserError('root must be a directory (end name with "/")', first.lineNo);
  }
  nodes[rootId] = root;

  const stack: { id: NodeId; depth: number }[] = [{ id: rootId, depth: 0 }];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= line.depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (!parent) {
      throw new ParserError('unexpected outdent', line.lineNo);
    }
    if (line.depth !== parent.depth + 1) {
      throw new ParserError(
        `unexpected indent jump (depth ${line.depth}, expected ${parent.depth + 1})`,
        line.lineNo,
      );
    }
    const id = makeNewNodeId(line.name + ':' + line.lineNo);
    const parentNode = nodes[parent.id] as DirNode;
    if (line.isDir) {
      const dir: DirNode = {
        id,
        name: line.name,
        kind: 'dir',
        parentId: parent.id,
        childIds: [],
        expanded: true,
        dirty: 'new',
      };
      nodes[id] = dir;
      parentNode.childIds.push(id);
      stack.push({ id, depth: line.depth });
    } else {
      const file: FileNode = {
        id,
        name: line.name,
        kind: 'file',
        parentId: parent.id,
        size: 0,
        modified: 0,
        ext: extOf(line.name),
        dirty: 'new',
      };
      nodes[id] = file;
      parentNode.childIds.push(id);
    }
  }

  return { rootId, nodes, rootFsPath: null };
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}
