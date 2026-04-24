import { useMemo } from 'react';
import { useTreeStore } from '@/stores';
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';
import { useT } from '@/lib/i18n';

export function StatusBar() {
  const nodes = useTreeStore(s => s.nodes);
  const rootId = useTreeStore(s => s.rootId);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const error = useTreeStore(s => s.error);
  const t = useT();
  const summary = useMemo(
    () => summarize(diffFromDirtyFlags({ nodes, rootId, rootFsPath })),
    [nodes, rootId, rootFsPath],
  );

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-1 text-xs glass">
      <div className="font-mono-tight text-muted-foreground">
        {summary.total === 0 ? (
          t('status.noPending')
        ) : (
          <>
            <span className="text-diff-added">{t('status.added')}: {summary.added}</span>
            {' · '}
            <span className="text-diff-moved">{t('status.moved')}: {summary.moved}</span>
            {' · '}
            <span className="text-diff-renamed">{t('status.renamed')}: {summary.renamed}</span>
            {' · '}
            <span className="text-diff-removed">{t('status.removed')}: {summary.removed}</span>
            {' · '}
            {t('status.applyHint')}
          </>
        )}
      </div>
      {error && (
        <div className="text-destructive font-mono-tight">
          {t('common.error')}: {error}
        </div>
      )}
    </div>
  );
}
