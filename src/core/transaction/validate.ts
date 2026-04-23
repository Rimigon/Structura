import type { Operation, Transaction } from '@/types';
import { isValidName } from '../tree/paths';

export interface ValidationIssue {
  opIndex: number;
  message: string;
}

export function validateTransaction(tx: Transaction): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rootLower = tx.rootFsPath.replace(/\\/g, '/').toLowerCase();

  tx.ops.forEach((op, i) => {
    for (const p of pathsOfOp(op)) {
      const normalized = p.replace(/\\/g, '/').toLowerCase();
      if (!normalized.startsWith(rootLower)) {
        issues.push({ opIndex: i, message: `path outside rootFsPath: ${p}` });
      }
    }
    if (op.kind === 'rename' && !isValidName(op.newName)) {
      issues.push({ opIndex: i, message: `invalid rename target name: "${op.newName}"` });
    }
  });

  return issues;
}

function pathsOfOp(op: Operation): string[] {
  switch (op.kind) {
    case 'move':
      return [op.from, op.to];
    case 'rename':
      return [op.path];
    case 'delete':
      return [op.path];
    case 'mkdir':
      return [op.path];
    case 'touch':
      return [op.path];
  }
}
