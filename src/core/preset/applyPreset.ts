import type {
  DirNode,
  FileNode,
  NodeId,
  Operation,
  Preset,
  TreeNode,
  TreeState,
} from '@/types';
import { DEFAULT_FLATTEN_CONFIG } from '@/types';
import { flatten } from '@/core/flatten/flatten';
import { applyTemplate } from '@/core/flatten/renameTemplate';

/** Dispatches a preset against the current virtual tree and returns the set of
 *  sandbox Operations. Pure — does not write to disk and does not mutate state.
 *  Returns [] for kinds that have no sandbox-only representation (e.g. dedup,
 *  which is delegated to DedupDialog at the UI layer). */
export function applyPreset(
  state: TreeState,
  preset: Preset,
  targetId: NodeId,
): Operation[] {
  if (preset.config.kind === 'flatten') {
    const { tx } = flatten(
      state,
      targetId,
      preset.config.flatten ?? DEFAULT_FLATTEN_CONFIG,
    );
    return tx.ops as Operation[];
  }
  if (preset.config.kind === 'rename') {
    return renameOps(state, targetId, preset.config.rename);
  }
  // dedup — handled by DedupDialog; no pure ops here.
  return [];
}

function collectRenameTargets(
  state: TreeState,
  targetId: NodeId,
  scope: 'children' | 'descendants',
  targetKind: 'files' | 'dirs' | 'both',
): TreeNode[] {
  const target = state.nodes[targetId];
  if (!target || target.kind !== 'dir') return [];
  const out: TreeNode[] = [];
  const accept = (n: TreeNode): boolean => {
    if (n.dirty === 'deleted') return false;
    if (!n.originalPath) return false; // skip sandbox-only nodes
    if (targetKind === 'files' && n.kind !== 'file') return false;
    if (targetKind === 'dirs' && n.kind !== 'dir') return false;
    return true;
  };
  if (scope === 'children') {
    for (const cid of (target as DirNode).childIds) {
      const c = state.nodes[cid];
      if (c && accept(c)) out.push(c);
    }
  } else {
    const walk = (id: NodeId) => {
      const n = state.nodes[id];
      if (!n) return;
      if (n.id !== targetId && accept(n)) out.push(n);
      if (n.kind === 'dir') {
        for (const cid of (n as DirNode).childIds) walk(cid);
      }
    };
    walk(targetId);
  }
  return out;
}

function renameOps(
  state: TreeState,
  targetId: NodeId,
  cfg: { template: string; targetKind: 'files' | 'dirs' | 'both'; scope: 'children' | 'descendants' },
): Operation[] {
  const targets = collectRenameTargets(state, targetId, cfg.scope, cfg.targetKind);
  if (targets.length === 0) return [];
  const ops: Operation[] = [];
  // Track resulting names per parent so we can suffix collisions (- (2), - (3))
  const takenByParent = new Map<NodeId, Set<string>>();
  const seedParent = (parentId: NodeId): Set<string> => {
    const existing = takenByParent.get(parentId);
    if (existing) return existing;
    const taken = new Set<string>();
    const parent = state.nodes[parentId];
    if (parent && parent.kind === 'dir') {
      for (const cid of (parent as DirNode).childIds) {
        const c = state.nodes[cid];
        if (c && c.dirty !== 'deleted') taken.add(c.name);
      }
    }
    takenByParent.set(parentId, taken);
    return taken;
  };
  let counter = 1;
  for (const node of targets) {
    if (!node.parentId || !node.originalPath) continue;
    const parent = state.nodes[node.parentId];
    const grand = parent?.parentId ? state.nodes[parent.parentId] : null;
    const ext =
      node.kind === 'file' && (node as FileNode).ext
        ? '.' + (node as FileNode).ext
        : '';
    const raw = applyTemplate(cfg.template, {
      file: node.name,
      parent: parent?.name ?? '',
      grandparent: grand?.name ?? '',
      counter: counter++,
    });
    const cleaned = raw.replace(/^\s*—\s*/, '').trim() || node.name;
    const needsExt =
      !/\{ext\}/.test(cfg.template) &&
      ext &&
      !cleaned.toLowerCase().endsWith(ext.toLowerCase());
    let finalName = needsExt ? cleaned + ext : cleaned;
    if (finalName === node.name) continue;
    // Suffix collisions
    const taken = seedParent(node.parentId);
    if (taken.has(finalName)) {
      const dot = finalName.lastIndexOf('.');
      const hasExt = dot > 0 && dot < finalName.length - 1;
      const base = hasExt ? finalName.slice(0, dot) : finalName;
      const tail = hasExt ? finalName.slice(dot) : '';
      let i = 2;
      while (taken.has(`${base} (${i})${tail}`) && i < 10000) i++;
      finalName = `${base} (${i})${tail}`;
    }
    taken.delete(node.name);
    taken.add(finalName);
    ops.push({ kind: 'rename', path: node.originalPath, newName: finalName });
  }
  return ops;
}
