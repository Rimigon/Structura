import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MonoText } from '@/components/common/MonoText';
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';
import { estimateBytes } from '@/core/transaction/estimate';
import { useTreeStore, useUIStore } from '@/stores';
import type { Operation, TreeState, Transaction, TxResult } from '@/types';
import { checkDiskSpace, isTauri, type DiskCheck } from '@/lib/tauri';

const KIND_LABEL_RU: Record<'added' | 'removed' | 'renamed' | 'moved' | 'unchanged', string> = {
  added: 'добавить',
  removed: 'удалить',
  renamed: 'переименовать',
  moved: 'переместить',
  unchanged: 'без изменений',
};

export function ApplyDialog() {
  const open = useUIStore(s => s.applyDialogOpen);
  const setOpen = useUIStore(s => s.setApplyDialogOpen);
  const state = useTreeStore();
  const diff = useMemo(() => diffFromDirtyFlags(state), [state]);
  const summary = summarize(diff);
  const ops = useMemo(() => opsFromDiff(diff, state), [diff, state]);
  const required = useMemo(() => estimateBytes(state, ops), [state, ops]);
  const [result, setResult] = useState<TxResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [disk, setDisk] = useState<DiskCheck | null>(null);
  const [diskError, setDiskError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isTauri() || !state.rootFsPath || summary.total === 0) {
      setDisk(null);
      setDiskError(null);
      return;
    }
    let cancelled = false;
    checkDiskSpace(state.rootFsPath, Math.max(0, Math.ceil(required)))
      .then(r => {
        if (!cancelled) {
          setDisk(r);
          setDiskError(null);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setDisk(null);
          setDiskError((e as Error).message ?? String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, state.rootFsPath, required, summary.total]);

  const handleApply = async () => {
    if (!state.rootFsPath) return;
    setBusy(true);
    try {
      const tx: Transaction = {
        id: 'tx_' + Date.now().toString(36),
        createdAt: Date.now(),
        label: 'Применение изменений из песочницы',
        rootFsPath: state.rootFsPath,
        ops,
        inverse: [],
      };
      if (!isTauri()) {
        setResult({
          txId: tx.id,
          results: ops.map(op => ({ op, status: 'skipped' })),
          completedAt: Date.now(),
        });
        return;
      }
      const r = await state.applyToDisk(tx);
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Применить изменения к диску</DialogTitle>
          <DialogDescription>
            {summary.total === 0
              ? 'Нет ожидающих изменений.'
              : `Будет выполнено операций: ${summary.total}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 text-xs font-mono-tight">
          <span className="text-diff-added">+{summary.added} добавить</span>
          <span className="text-diff-moved">→{summary.moved} переместить</span>
          <span className="text-diff-renamed">~{summary.renamed} переименовать</span>
          <span className="text-diff-removed">×{summary.removed} удалить</span>
        </div>
        <ScrollArea className="max-h-[320px] rounded-md border border-border p-2 scrollbar-thin">
          <ul className="space-y-1">
            {diff.map(entry => (
              <li key={entry.nodeId} className="text-xs">
                <span
                  className={{
                    added: 'text-diff-added',
                    removed: 'text-diff-removed',
                    renamed: 'text-diff-renamed',
                    moved: 'text-diff-moved',
                    unchanged: 'text-muted-foreground',
                  }[entry.kind]}
                >
                  [{KIND_LABEL_RU[entry.kind]}]
                </span>{' '}
                <MonoText className="text-xs">
                  {entry.fromPath ?? ''}
                  {entry.fromPath && entry.toPath ? ' → ' : ''}
                  {entry.toPath ?? ''}
                </MonoText>
              </li>
            ))}
          </ul>
        </ScrollArea>
        {disk && summary.total > 0 && (
          <div
            className={
              'rounded-md border p-2 text-xs font-mono-tight ' +
              (disk.sufficient
                ? 'border-border bg-card/60 text-muted-foreground'
                : 'border-destructive/60 bg-destructive/10 text-destructive')
            }
          >
            {disk.sufficient
              ? `Места достаточно. Требуется ~${formatBytes(disk.required)}, доступно ${formatBytes(disk.available)}.`
              : `Недостаточно места на диске. Требуется ${formatBytes(disk.required)}, доступно ${formatBytes(disk.available)}.`}
          </div>
        )}
        {diskError && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs font-mono-tight text-destructive">
            Не удалось проверить свободное место: {diskError}
          </div>
        )}
        {result && (
          <div className="rounded-md border border-border bg-card/60 p-2 text-xs font-mono-tight">
            успешно: {result.results.filter(r => r.status === 'ok').length}
            {' · '}
            с ошибками: {result.results.filter(r => r.status === 'error').length}
            {' · '}
            пропущено: {result.results.filter(r => r.status === 'skipped').length}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
          <Button
            onClick={handleApply}
            disabled={busy || summary.total === 0 || disk?.sufficient === false}
          >
            {busy ? 'Применение…' : 'Применить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(n: number): string {
  if (n <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const val = n / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function opsFromDiff(
  diff: ReturnType<typeof diffFromDirtyFlags>,
  state: TreeState,
): Operation[] {
  const ops: Operation[] = [];
  for (const entry of diff) {
    if (entry.kind === 'added' && entry.toPath) {
      const n = state.nodes[entry.nodeId];
      if (n?.kind === 'file') {
        ops.push({ kind: 'touch', path: entry.toPath });
      } else {
        ops.push({ kind: 'mkdir', path: entry.toPath });
      }
    } else if (entry.kind === 'removed' && entry.fromPath) {
      ops.push({ kind: 'delete', path: entry.fromPath, recursive: false });
    } else if (entry.kind === 'moved' && entry.fromPath && entry.toPath) {
      ops.push({ kind: 'move', from: entry.fromPath, to: entry.toPath });
    } else if (entry.kind === 'renamed' && entry.fromPath && entry.toPath) {
      const newName = entry.toPath.split(/[\\/]/).pop()!;
      ops.push({ kind: 'rename', path: entry.fromPath, newName });
    }
  }
  return orderOps(ops);
}

function orderOps(ops: Operation[]): Operation[] {
  const mkdirs: Operation[] = [];
  const touches: Operation[] = [];
  const renames: Operation[] = [];
  const moves: Operation[] = [];
  const deletes: Operation[] = [];
  for (const op of ops) {
    if (op.kind === 'mkdir') mkdirs.push(op);
    else if (op.kind === 'touch') touches.push(op);
    else if (op.kind === 'rename') renames.push(op);
    else if (op.kind === 'move') moves.push(op);
    else if (op.kind === 'delete') deletes.push(op);
  }
  mkdirs.sort((a, b) => pathOf(a).length - pathOf(b).length);
  touches.sort((a, b) => pathOf(a).length - pathOf(b).length);
  deletes.sort((a, b) => pathOf(b).length - pathOf(a).length);
  return [...mkdirs, ...touches, ...renames, ...moves, ...deletes];
}

function pathOf(op: Operation): string {
  return 'path' in op ? op.path : op.kind === 'move' ? op.to : '';
}
