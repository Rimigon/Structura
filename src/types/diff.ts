import type { NodeId } from './tree';

export type DiffKind = 'added' | 'removed' | 'renamed' | 'moved' | 'unchanged';

export interface DiffEntry {
  nodeId: NodeId;
  kind: DiffKind;
  fromPath?: string;
  toPath?: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  renamed: number;
  moved: number;
  total: number;
}
