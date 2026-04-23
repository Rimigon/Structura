import { useMemo } from 'react';
import { useTreeStore } from '@/stores';
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';

export function StatusBar() {
  const nodes = useTreeStore(s => s.nodes);
  const rootId = useTreeStore(s => s.rootId);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const error = useTreeStore(s => s.error);
  const summary = useMemo(
    () => summarize(diffFromDirtyFlags({ nodes, rootId, rootFsPath })),
    [nodes, rootId, rootFsPath],
  );

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-1 text-xs glass">
      <div className="font-mono-tight text-muted-foreground">
        {summary.total === 0 ? (
          'Нет ожидающих изменений'
        ) : (
          <>
            <span className="text-diff-added">добавлено: {summary.added}</span>
            {' · '}
            <span className="text-diff-moved">перемещено: {summary.moved}</span>
            {' · '}
            <span className="text-diff-renamed">переименовано: {summary.renamed}</span>
            {' · '}
            <span className="text-diff-removed">удалено: {summary.removed}</span>
            {' · Ctrl+S — применить'}
          </>
        )}
      </div>
      {error && (
        <div className="text-destructive font-mono-tight">Ошибка: {error}</div>
      )}
    </div>
  );
}
