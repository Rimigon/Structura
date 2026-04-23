import type { NodeId, Operation, TreeState } from '@/types';
import { walkDirsDeepestFirst, walkFiles } from '../tree/traverse';

export function computeEmptyDirOps(
  tree: TreeState,
  rootId: NodeId,
  moveSourcePaths: Set<string>,
): Operation[] {
  const ops: Operation[] = [];
  for (const dir of walkDirsDeepestFirst(tree, rootId)) {
    if (dir.id === rootId) continue;
    if (!dir.originalPath) continue;
    const hasRemainingFiles = [...walkFiles(tree, dir.id)].some(
      f => f.originalPath && !moveSourcePaths.has(f.originalPath),
    );
    if (hasRemainingFiles) continue;
    ops.push({ kind: 'delete', path: dir.originalPath, recursive: false });
  }
  return ops;
}
