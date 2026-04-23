import type { Operation, TreeState } from '@/types';

const MKDIR_OVERHEAD_BYTES = 4096;

export function estimateBytes(state: TreeState, ops: Operation[]): number {
  if (!state.rootFsPath) return 0;
  const rootVolume = volumeOf(state.rootFsPath);
  let total = 0;
  for (const op of ops) {
    switch (op.kind) {
      case 'mkdir':
        total += MKDIR_OVERHEAD_BYTES;
        break;
      case 'move': {
        if (volumeOf(op.from) === rootVolume && volumeOf(op.to) === rootVolume) break;
        total += sizeOfPath(state, op.from);
        break;
      }
      case 'rename':
      case 'delete':
        break;
    }
  }
  return total;
}

function volumeOf(path: string): string {
  const m = /^([a-zA-Z]):/.exec(path);
  if (m) return m[1]!.toLowerCase();
  if (path.startsWith('//') || path.startsWith('\\\\')) {
    const rest = path.replace(/^[\\/]{2}/, '');
    const sep = rest.search(/[\\/]/);
    return 'unc:' + (sep > 0 ? rest.slice(0, sep) : rest).toLowerCase();
  }
  return '/';
}

function sizeOfPath(state: TreeState, absPath: string): number {
  for (const node of Object.values(state.nodes)) {
    if (node.kind === 'file' && node.originalPath === absPath) return node.size;
  }
  return 0;
}
