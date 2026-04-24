import type { OpResult, Operation } from '@/types';
import { dirname, joinPath } from '../tree/paths';

export function invertOp(op: Operation, trashPath?: string): Operation | null {
  switch (op.kind) {
    case 'move':
      return { kind: 'move', from: op.to, to: op.from };
    case 'rename': {
      const parent = dirname(op.path);
      const newPath = joinPath(parent, op.newName);
      const oldName = op.path.slice(parent.length).replace(/^[\\/]/, '');
      return { kind: 'rename', path: newPath, newName: oldName };
    }
    case 'mkdir':
      return { kind: 'delete', path: op.path, recursive: false };
    case 'touch':
      return { kind: 'delete', path: op.path, recursive: false };
    case 'delete':
      if (trashPath) return { kind: 'move', from: trashPath, to: op.path };
      return null;
    case 'copy':
      return { kind: 'delete', path: op.to, recursive: op.recursive };
    case 'symlink':
      return { kind: 'delete', path: op.to, recursive: false };
    case 'hardlink':
      return { kind: 'delete', path: op.to, recursive: false };
  }
}

export function invertOps(ops: Operation[]): Operation[] {
  const reversed = [...ops].reverse();
  const inverse: Operation[] = [];
  for (const op of reversed) {
    const inv = invertOp(op);
    if (inv) inverse.push(inv);
  }
  return inverse;
}

export function invertTxResult(results: OpResult[]): Operation[] {
  const successful = results.filter(r => r.status === 'ok');
  const reversed = [...successful].reverse();
  const inverse: Operation[] = [];
  for (const r of reversed) {
    const inv = invertOp(r.op, r.trashPath);
    if (inv) inverse.push(inv);
  }
  return inverse;
}
