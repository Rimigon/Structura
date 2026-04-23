import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';

function primaryAction(summary: {
  added: number;
  removed: number;
  renamed: number;
  moved: number;
}): string {
  const entries: [keyof typeof summary, string][] = [
    ['moved', 'Перемещение'],
    ['renamed', 'Переименование'],
    ['added', 'Создание'],
    ['removed', 'Удаление'],
  ];
  const first = entries.find(([k]) => summary[k] > 0);
  if (!first) return 'Нет операций';
  const others = entries.filter(([k]) => summary[k] > 0).length;
  return others > 1 ? `${first[1]} + ещё ${others - 1}` : first[1];
}

export function ActionBar() {
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const focusedId = useSelectionStore(s => s.focusedId);
  const setApplyDialogOpen = useUIStore(s => s.setApplyDialogOpen);

  const summary = useMemo(
    () => summarize(diffFromDirtyFlags({ nodes, rootId, rootFsPath })),
    [nodes, rootId, rootFsPath],
  );

  const selectedCount = multiSelect.size > 0 ? multiSelect.size : focusedId ? 1 : 0;

  if (summary.total === 0 && selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-4 neumorphic-inset px-4 py-2">
      <div className="flex-1 text-xs font-mono-tight text-muted-foreground">
        {selectedCount > 0 && (
          <span className="mr-3">
            Выбрано:{' '}
            <span className="text-foreground font-semibold">{selectedCount}</span>
          </span>
        )}
        {summary.total > 0 && (
          <>
            Ожидаемое действие:{' '}
            <span className="text-foreground font-semibold">{primaryAction(summary)}</span>
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
        ВЫПОЛНИТЬ
      </Button>
    </div>
  );
}
