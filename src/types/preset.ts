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

export interface RenameConfig {
  pattern: string;
  variables: string[];
}

export type PresetConfig =
  | { kind: 'flatten'; flatten: FlattenConfig }
  | { kind: 'rename'; rename: RenameConfig };

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
