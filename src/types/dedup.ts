export interface DuplicateGroup {
  hash: string;
  size: number;
  paths: string[];
}

export type DedupPhase = 'scanning' | 'hashing' | 'verifying' | 'done';

export interface DedupProgress {
  phase: DedupPhase;
  /** Files processed in the current phase. */
  processed: number;
  /** Total files for the current phase; 0 while indeterminate (scanning). */
  total: number;
}
