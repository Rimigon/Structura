import type {
  ConflictResolution,
  DirNode,
  FileNode,
  FlattenConfig,
  NodeId,
  Operation,
  PendingConflict,
  Transaction,
  TreeState,
  TreeNode,
} from '@/types';
import { walkDirsDeepestFirst, walkFiles } from '../tree/traverse';
import { joinPath } from '../tree/paths';
import { resolveName } from './conflictResolver';
import { applyTemplate } from './renameTemplate';

export interface FlattenResult {
  tx: Transaction;
  pending: PendingConflict[];
}

export function flatten(
  tree: TreeState,
  targetDirId: NodeId,
  cfg: FlattenConfig,
  resolutions?: Map<NodeId, ConflictResolution>,
): FlattenResult {
  const mode = cfg.mode ?? 'into-target';
  return mode === 'dissolve'
    ? flattenDissolve(tree, targetDirId, cfg, resolutions)
    : flattenInto(tree, targetDirId, cfg, resolutions);
}

function flattenInto(
  tree: TreeState,
  targetDirId: NodeId,
  cfg: FlattenConfig,
  resolutions?: Map<NodeId, ConflictResolution>,
): FlattenResult {
  const target = tree.nodes[targetDirId];
  if (!target || target.kind !== 'dir') {
    throw new Error(`flatten target ${targetDirId} is not a directory`);
  }
  if (!target.originalPath) {
    throw new Error('flatten target has no originalPath (must exist on disk)');
  }
  if (!tree.rootFsPath) {
    throw new Error('tree has no rootFsPath');
  }

  const targetPath = target.originalPath;
  const existingByName = buildExistingMap(tree, target, targetDirId);
  const taken = new Set<string>(existingByName.keys());
  const ops: Operation[] = [];
  const pending: PendingConflict[] = [];
  const maxSize = cfg.maxFileSizeBytes ?? null;

  for (const file of walkFiles(tree, targetDirId)) {
    if (file.parentId === targetDirId) continue;
    if (!file.originalPath) continue;
    if (maxSize !== null && file.size > maxSize) continue;

    const parent = tree.nodes[file.parentId!] as DirNode | undefined;
    const parentName = parent?.name ?? '';
    const templated = cfg.renameTemplate
      ? applyTemplate(cfg.renameTemplate, { file: file.name, parent: parentName })
      : file.name;

    const emitMove = (finalName: string) => {
      taken.add(finalName);
      ops.push({
        kind: 'move',
        from: file.originalPath!,
        to: joinPath(targetPath, finalName),
      });
    };

    if (cfg.conflictStrategy === 'ask' && taken.has(templated)) {
      const resolution = resolutions?.get(file.id);
      if (!resolution) {
        const existing = existingByName.get(templated);
        pending.push({
          fileNodeId: file.id,
          fileName: templated,
          fromPath: file.originalPath,
          existingName: existing?.name ?? templated,
          parentName,
        });
        continue;
      }
      applyResolution(file, resolution, parentName, targetPath, templated, existingByName, taken, ops);
      continue;
    }

    const finalName = resolveName(templated, parentName, taken, cfg.conflictStrategy);
    if (cfg.conflictStrategy === 'skip' && taken.has(finalName) && finalName === templated) {
      continue;
    }
    emitMove(finalName);
  }

  if (cfg.cleanupEmpty && pending.length === 0) {
    for (const dir of walkDirsDeepestFirst(tree, targetDirId)) {
      if (dir.id === targetDirId) continue;
      if (!dir.originalPath) continue;
      ops.push({ kind: 'delete', path: dir.originalPath, recursive: false });
    }
  }

  return { tx: makeTx(tree, target.name, ops), pending };
}

function flattenDissolve(
  tree: TreeState,
  targetDirId: NodeId,
  cfg: FlattenConfig,
  resolutions?: Map<NodeId, ConflictResolution>,
): FlattenResult {
  const target = tree.nodes[targetDirId];
  if (!target || target.kind !== 'dir') {
    throw new Error(`dissolve target ${targetDirId} is not a directory`);
  }
  if (!target.parentId) {
    throw new Error('Нельзя схлопнуть корневую папку');
  }
  if (!target.originalPath) {
    throw new Error('dissolve target has no originalPath');
  }
  const parent = tree.nodes[target.parentId];
  if (!parent || parent.kind !== 'dir' || !parent.originalPath) {
    throw new Error('parent of dissolve target not found');
  }
  if (!tree.rootFsPath) {
    throw new Error('tree has no rootFsPath');
  }

  const destPath = parent.originalPath;
  const existingByName = buildExistingMap(tree, parent, parent.id);
  existingByName.delete(target.name);
  const taken = new Set<string>(existingByName.keys());
  const ops: Operation[] = [];
  const pending: PendingConflict[] = [];
  const maxSize = cfg.maxFileSizeBytes ?? null;

  for (const file of walkFiles(tree, targetDirId)) {
    if (!file.originalPath) continue;
    if (maxSize !== null && file.size > maxSize) continue;

    const fileParent = tree.nodes[file.parentId!] as DirNode | undefined;
    const parentName = fileParent?.name ?? target.name;
    const templated = cfg.renameTemplate
      ? applyTemplate(cfg.renameTemplate, { file: file.name, parent: parentName, grandparent: target.name })
      : file.name;

    if (cfg.conflictStrategy === 'ask' && taken.has(templated)) {
      const resolution = resolutions?.get(file.id);
      if (!resolution) {
        const existing = existingByName.get(templated);
        pending.push({
          fileNodeId: file.id,
          fileName: templated,
          fromPath: file.originalPath,
          existingName: existing?.name ?? templated,
          parentName,
        });
        continue;
      }
      applyResolution(file, resolution, parentName, destPath, templated, existingByName, taken, ops);
      continue;
    }

    const finalName = resolveName(templated, parentName, taken, cfg.conflictStrategy);
    if (cfg.conflictStrategy === 'skip' && taken.has(finalName) && finalName === templated) {
      continue;
    }
    taken.add(finalName);
    ops.push({
      kind: 'move',
      from: file.originalPath,
      to: joinPath(destPath, finalName),
    });
  }

  if (cfg.cleanupEmpty && pending.length === 0) {
    for (const dir of walkDirsDeepestFirst(tree, targetDirId)) {
      if (!dir.originalPath) continue;
      ops.push({ kind: 'delete', path: dir.originalPath, recursive: false });
    }
  }

  return { tx: makeTx(tree, `Схлопнуть ${target.name}`, ops), pending };
}

function applyResolution(
  file: FileNode,
  resolution: ConflictResolution,
  parentName: string,
  targetPath: string,
  preferredName: string,
  existingByName: Map<string, TreeNode>,
  taken: Set<string>,
  ops: Operation[],
): void {
  const existing = existingByName.get(preferredName);

  if (resolution.kind === 'skip') return;

  if (resolution.kind === 'keep-both') {
    const name = resolveName(preferredName, parentName, taken, 'parent-prefix-then-counter');
    taken.add(name);
    ops.push({ kind: 'move', from: file.originalPath!, to: joinPath(targetPath, name) });
    return;
  }

  if (resolution.kind === 'newer') {
    const existingModified =
      existing && existing.kind === 'file' ? existing.modified : 0;
    if (file.modified <= existingModified) return;
  }

  if (existing && existing.kind === 'file' && existing.originalPath) {
    ops.push({ kind: 'delete', path: existing.originalPath, recursive: false });
  }
  ops.push({ kind: 'move', from: file.originalPath!, to: joinPath(targetPath, preferredName) });
}

function buildExistingMap(
  tree: TreeState,
  target: DirNode,
  targetId: NodeId,
): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  for (const childId of target.childIds) {
    const child = tree.nodes[childId];
    if (!child || child.dirty === 'deleted') continue;
    if (child.parentId !== targetId) continue;
    map.set(child.name, child);
  }
  return map;
}

function makeTx(tree: TreeState, label: string, ops: Operation[]): Transaction {
  return {
    id: makeTxId(),
    createdAt: Date.now(),
    label,
    rootFsPath: tree.rootFsPath!,
    ops,
    inverse: [],
  };
}

function makeTxId(): string {
  return 'tx_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
