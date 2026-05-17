export type ConflictStrategy =
  | 'parent-prefix-then-counter'
  | 'counter-only'
  | 'skip'
  | 'overwrite'
  | 'ask';

export type FlattenMode = 'into-target' | 'dissolve';

export interface FlattenConfig {
  mode?: FlattenMode;
  conflictStrategy: ConflictStrategy;
  cleanupEmpty: boolean;
  maxFileSizeBytes?: number | null;
  renameTemplate?: string | null;
}

export type ConflictResolution =
  | { kind: 'keep-both' }
  | { kind: 'newer' }
  | { kind: 'replace' }
  | { kind: 'skip' };

export interface PendingConflict {
  fileNodeId: string;
  fileName: string;
  fromPath: string;
  existingName: string;
  parentName: string;
}

export type RenameTarget = 'files' | 'dirs' | 'both';
export type RenameScope = 'children' | 'descendants';

export interface RenameConfig {
  /** Template syntax shared with BatchRenameDialog (see `src/core/flatten/renameTemplate`). */
  template: string;
  targetKind: RenameTarget;
  /** `children` — only direct children of the focused dir; `descendants` — entire subtree. */
  scope: RenameScope;
}

export type DedupAction = 'mark' | 'keepNewest' | 'keepOldest';

export interface DedupConfig {
  /** Files below this size are skipped (defaults to 1 KB). */
  minSizeBytes: number;
  /** `mark` — soft-delete duplicates (keep first by name); keepNewest/keepOldest pick the winner by mtime. */
  autoAction: DedupAction;
}

export type PresetConfig =
  | { kind: 'flatten'; flatten: FlattenConfig }
  | { kind: 'rename'; rename: RenameConfig }
  | { kind: 'dedup'; dedup: DedupConfig };

export type PresetKind = PresetConfig['kind'];

export interface Preset {
  id: string;
  name: string;
  description?: string;
  config: PresetConfig;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_FLATTEN_CONFIG: FlattenConfig = {
  mode: 'into-target',
  conflictStrategy: 'parent-prefix-then-counter',
  cleanupEmpty: true,
  maxFileSizeBytes: null,
  renameTemplate: null,
};

export const DEFAULT_RENAME_CONFIG: RenameConfig = {
  template: '{n:02} — {file}',
  targetKind: 'files',
  scope: 'children',
};

export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  minSizeBytes: 1024,
  autoAction: 'mark',
};
