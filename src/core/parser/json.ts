import type { DirNode, FileNode, NodeId, TreeNode, TreeState } from '@/types';
import { makeNewNodeId } from '../tree/identity';
import { isValidName } from '../tree/paths';
import { ParserError } from './tabIndent';

interface JsonNode {
  name: string;
  kind: 'file' | 'dir';
  children?: JsonNode[];
}

interface JsonDoc {
  version: number;
  root: JsonNode;
}

export function parseJson(text: string): TreeState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new ParserError(`invalid JSON: ${(e as Error).message}`, 1);
  }
  const doc = parsed as JsonDoc;
  if (!doc || typeof doc !== 'object') {
    throw new ParserError('expected object with {version, root}', 1);
  }
  if (doc.version !== 1) {
    throw new ParserError(`unsupported version ${doc.version} (expected 1)`, 1);
  }
  if (!doc.root || typeof doc.root !== 'object') {
    throw new ParserError('missing or invalid "root"', 1);
  }
  if (doc.root.kind !== 'dir') {
    throw new ParserError('root must have kind="dir"', 1);
  }

  const nodes: Record<NodeId, TreeNode> = {};
  const rootId = buildNode(doc.root, null, nodes);
  return { rootId, nodes, rootFsPath: null };
}

function buildNode(
  raw: JsonNode,
  parentId: NodeId | null,
  nodes: Record<NodeId, TreeNode>,
): NodeId {
  if (!raw || typeof raw !== 'object') {
    throw new ParserError('expected node object', 1);
  }
  if (typeof raw.name !== 'string') {
    throw new ParserError('node missing "name" string', 1);
  }
  if (raw.kind !== 'file' && raw.kind !== 'dir') {
    throw new ParserError(`node "${raw.name}" has invalid kind`, 1);
  }
  if (!isValidName(raw.name)) {
    throw new ParserError(`invalid name "${raw.name}"`, 1);
  }

  const id = makeNewNodeId(raw.name + ':' + (parentId ?? 'root'));
  if (raw.kind === 'dir') {
    const dir: DirNode = {
      id,
      name: raw.name,
      kind: 'dir',
      parentId,
      childIds: [],
      expanded: true,
      dirty: 'new',
    };
    nodes[id] = dir;
    if (Array.isArray(raw.children)) {
      for (const child of raw.children) {
        dir.childIds.push(buildNode(child, id, nodes));
      }
    }
  } else {
    if (raw.children) {
      throw new ParserError(`file "${raw.name}" must not have children`, 1);
    }
    const file: FileNode = {
      id,
      name: raw.name,
      kind: 'file',
      parentId,
      size: 0,
      modified: 0,
      ext: extOf(raw.name),
      dirty: 'new',
    };
    nodes[id] = file;
  }
  return id;
}

export function treeToJson(state: TreeState): string {
  if (!state.rootId) return JSON.stringify({ version: 1, root: null }, null, 2);
  const doc: JsonDoc = { version: 1, root: emitNode(state, state.rootId) };
  return JSON.stringify(doc, null, 2);
}

function emitNode(state: TreeState, id: NodeId): JsonNode {
  const node = state.nodes[id];
  if (!node) throw new Error(`node ${id} not found`);
  if (node.kind === 'dir') {
    const children: JsonNode[] = [];
    for (const cid of node.childIds) {
      const child = state.nodes[cid];
      if (!child || child.dirty === 'deleted') continue;
      children.push(emitNode(state, cid));
    }
    return { name: node.name, kind: 'dir', children };
  }
  return { name: node.name, kind: 'file' };
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}
