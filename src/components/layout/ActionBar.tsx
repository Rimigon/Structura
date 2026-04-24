import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';
import { useT } from '@/lib/i18n';

export function ActionBar() {
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const focusedId = useSelectionStore(s => s.focusedId);
  const setApplyDialogOpen = useUIStore(s => s.setApplyDialogOpen);
  const t = useT();

  const summary = useMemo(
    () => summarize(diffFromDirtyFlags({ nodes, rootId, rootFsPath })),
    [nodes, rootId, rootFsPath],
  );

  const selectedCount = multiSelect.size > 0 ? multiSelect.size : focusedId ? 1 : 0;

  const primaryAction = (() => {
    const entries: [keyof typeof summary, string][] = [
      ['moved', t('actionbar.op.moved')],
      ['renamed', t('actionbar.op.renamed')],
      ['added', t('actionbar.op.added')],
      ['removed', t('actionbar.op.removed')],
    ];
    const first = entries.find(([k]) => (summary as never)[k] > 0);
    if (!first) return t('actionbar.op.none');
    const others = entries.filter(([k]) => (summary as never)[k] > 0).length;
    return others > 1 ? `${first[1]} + ${t('actionbar.plus')} ${others - 1}` : first[1];
  })();

  if (summary.total === 0 && selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-4 neumorphic-inset px-4 py-2">
      <div className="flex-1 text-xs font-mono-tight text-muted-foreground">
        {selectedCount > 0 && (
          <span className="mr-3">
            {t('actionbar.selected')}:{' '}
            <span className="text-foreground font-semibold">{selectedCount}</span>
          </span>
        )}
        {summary.total > 0 && (
          <>
            {t('actionbar.expected')}:{' '}
            <span className="text-foreground font-semibold">{primaryAction}</span>
            {' · '}
            <span className="text-diff-added">+{summary.added}</span>{' '}
            <span className="text-diff-moved">→{summary.moved}</span>{' '}
            <span className="text-diff-renamed">~{summary.renamed}</span>{' '}
            <span className="text-diff-removed">×{summary.removed}</span>
          </>
        )}
      </div>
      <Button
        variant="default"
        size="lg"
        disabled={summary.total === 0}
        onClick={() => setApplyDialogOpen(true)}
        className="h-10 px-6 font-semibold tracking-wide shadow-lg"
      >
        <Play className="h-4 w-4" />
        {t('actionbar.run')}
      </Button>
    </div>
  );
}
