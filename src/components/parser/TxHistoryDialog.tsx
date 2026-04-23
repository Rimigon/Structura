import { useState } from 'react';
import { ChevronDown, ChevronRight, History, Undo2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MonoText } from '@/components/common/MonoText';
import type { Operation, Transaction } from '@/types';
import { applyTransaction, isTauri } from '@/lib/tauri';
import { useTreeStore, useTxHistoryStore, useUIStore } from '@/stores';

const KIND_LABEL: Record<Operation['kind'], string> = {
  move: 'переместить',
  rename: 'переименовать',
  delete: 'удалить',
  mkdir: 'создать папку',
  touch: 'создать файл',
};

const KIND_COLOR: Record<Operation['kind'], string> = {
  move: 'text-diff-moved',
  rename: 'text-diff-renamed',
  delete: 'text-diff-removed',
  mkdir: 'text-diff-added',
  touch: 'text-diff-added',
};

export function TxHistoryDialog() {
  const open = useUIStore(s => s.historyDialogOpen);
  const setOpen = useUIStore(s => s.setHistoryDialogOpen);
  const history = useTxHistoryStore(s => s.history);
  const markRolledBack = useTxHistoryStore(s => s.markRolledBack);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (txId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const handleRollback = async (txId: string) => {
    const entry = history.find(h => h.txId === txId);
    if (!entry || entry.rolledBack) return;
    setBusy(txId);
    setErr(null);
    try {
      const tx: Transaction = {
        id: 'rollback_' + Date.now().toString(36),
        createdAt: Date.now(),
        label: `Откат: ${entry.label}`,
        rootFsPath: entry.rootFsPath,
        ops: entry.inverseOps,
        inverse: [],
        continueOnError: true,
      };
      if (!isTauri()) {
        markRolledBack(txId);
        return;
      }
      const r = await applyTransaction(tx);
      const failed = r.results.filter(x => x.status === 'error');
      if (failed.length > 0) {
        setErr(`Откат выполнен с ошибками: ${failed[0]!.error ?? 'неизвестно'}`);
      }
      markRolledBack(txId);
      if (entry.rootFsPath) {
        await useTreeStore.getState().scanRoot(entry.rootFsPath);
      }
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История транзакций
          </DialogTitle>
          <DialogDescription>
            Последние применённые транзакции. Кликните по записи, чтобы увидеть
            операции. «Откатить» вернёт файлы из корзины в исходные места.
          </DialogDescription>
        </DialogHeader>
        {err && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive">
            {err}
          </div>
        )}
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            История пуста. Применённые транзакции появятся здесь.
          </div>
        ) : (
          <ScrollArea className="max-h-[480px] rounded-md border border-border scrollbar-thin">
            <ul className="divide-y divide-border">
              {history.map(tx => {
                const isOpen = expanded.has(tx.txId);
                return (
                  <li key={tx.txId} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(tx.txId)}
                        className="flex flex-1 min-w-0 items-center gap-2 text-left hover:bg-accent/40 rounded px-1 py-0.5"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <MonoText className="text-xs truncate">{tx.label}</MonoText>
                          <div className="text-[11px] text-muted-foreground font-mono-tight">
                            {new Date(tx.timestamp).toLocaleString('ru-RU')} · операций:{' '}
                            {tx.ops.length}
                            {tx.rolledBack && ' · откачено'}
                          </div>
                        </div>
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!busy || tx.rolledBack || tx.inverseOps.length === 0}
                        onClick={() => handleRollback(tx.txId)}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        {busy === tx.txId ? 'Откат…' : 'Откатить'}
                      </Button>
                    </div>
                    {isOpen && (
                      <div className="pl-5 space-y-1 border-l border-border ml-1.5">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Прямые операции ({tx.ops.length})
                        </div>
                        <ul className="space-y-0.5">
                          {tx.ops.map((op, idx) => (
                            <li key={idx} className="text-[11px] font-mono-tight">
                              <span className={KIND_COLOR[op.kind]}>
                                [{KIND_LABEL[op.kind]}]
                              </span>{' '}
                              {describeOp(op)}
                            </li>
                          ))}
                        </ul>
                        {tx.inverseOps.length > 0 && (
                          <>
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2">
                              Обратные операции (для отката)
                            </div>
                            <ul className="space-y-0.5">
                              {tx.inverseOps.map((op, idx) => (
                                <li key={idx} className="text-[11px] font-mono-tight opacity-70">
                                  <span className={KIND_COLOR[op.kind]}>
                                    [{KIND_LABEL[op.kind]}]
                                  </span>{' '}
                                  {describeOp(op)}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function describeOp(op: Operation): string {
  switch (op.kind) {
    case 'move':
      return `${op.from} → ${op.to}`;
    case 'rename':
      return `${op.path} → ${op.newName}`;
    case 'delete':
      return op.path + (op.recursive ? ' (рекурсивно)' : '');
    case 'mkdir':
      return op.path;
    case 'touch':
      return op.path;
  }
}
