import type { NodeId, Operation, RenameConfig, TreeState } from '@/types';

// P1 stub — not yet wired into the UI. Keep the interface stable so we can
// drop in the real implementation without touching call sites.
export function renameBatch(
  _tree: TreeState,
  _targetIds: NodeId[],
  _cfg: RenameConfig,
): Operation[] {
  throw new Error('Batch rename is not implemented in v0');
}

export function expandVariables(
  template: string,
  ctx: { parent: string; index: number; date: Date },
): string {
  return template
    .replace(/\{\{parent\}\}/g, ctx.parent)
    .replace(/\{\{index\}\}/g, String(ctx.index))
    .replace(/\{\{date\}\}/g, ctx.date.toISOString().slice(0, 10));
}
