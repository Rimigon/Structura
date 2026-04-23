import type { NodeId } from '@/types';

export function makeNodeId(absolutePath: string): NodeId {
  const normalized = absolutePath.replace(/\\/g, '/').toLowerCase();
  return 'p:' + djb2(normalized).toString(16);
}

export function makeNewNodeId(seed: string): NodeId {
  return 'n:' + djb2(seed + ':' + Date.now() + ':' + Math.random()).toString(16);
}

function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}
