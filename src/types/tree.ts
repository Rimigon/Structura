export type NodeId = string;

export type DirtyFlag = 'new' | 'moved' | 'renamed' | 'deleted';

export interface BaseNode {
  id: NodeId;
  name: string;
  parentId: NodeId | null;
  dirty?: DirtyFlag;
  originalPath?: string;
}

export interface FileNode extends BaseNode {
  kind: 'file';
  size: number;
  modified: number;
  ext: string;
}

export interface DirNode extends BaseNode {
  kind: 'dir';
  childIds: NodeId[];
  expanded?: boolean;
}

export type TreeNode = FileNode | DirNode;

export interface TreeState {
  rootId: NodeId | null;
  nodes: Record<NodeId, TreeNode>;
  rootFsPath: string | null;
}

export interface FsEntry {
  path: string;
  relPath: string;
  name: string;
  isDir: boolean;
  size: number;
  modified: number;
  ext: string;
}

export interface ScanOptions {
  maxDepth: number | null;
  followSymlinks: boolean;
  includeHidden: boolean;
  ignorePatterns: string[];
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  maxDepth: null,
  followSymlinks: false,
  includeHidden: false,
  ignorePatterns: [],
};
