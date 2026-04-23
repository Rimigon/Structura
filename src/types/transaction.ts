export type Operation =
  | { kind: 'move'; from: string; to: string }
  | { kind: 'rename'; path: string; newName: string }
  | { kind: 'delete'; path: string; recursive: boolean }
  | { kind: 'mkdir'; path: string }
  | { kind: 'touch'; path: string };

export interface Transaction {
  id: string;
  createdAt: number;
  label: string;
  rootFsPath: string;
  ops: Operation[];
  inverse: Operation[];
  continueOnError?: boolean;
}

export type OpStatus = 'ok' | 'skipped' | 'error';

export interface OpResult {
  op: Operation;
  status: OpStatus;
  error?: string;
  trashPath?: string;
}

export interface TxResult {
  txId: string;
  results: OpResult[];
  completedAt: number;
}
