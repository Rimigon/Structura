import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Copy, FileSearch, Link2, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MonoText } from '@/components/common/MonoText';
import { useTreeStore, useUIStore } from '@/stores';
import { findDuplicates, isTauri } from '@/lib/tauri';
import { useT } from '@/lib/i18n';
import type { DedupProgress, DuplicateGroup, Operation, Transaction } from '@/types';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

function shortPath(p: string, root: string | null): string {
  if (root && p.startsWith(root)) {
    const tail = p.slice(root.length).replace(/^[\\/]+/, '');
    return tail || basename(p);
  }
  return p;
}

export function DedupDialog() {
  const open = useUIStore(s => s.dedupDialogOpen);
  const setOpen = useUIStore(s => s.setDedupDialogOpen);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const applyToDisk = useTreeStore(s => s.applyToDisk);
  const t = useT();

  const [minSizeKB, setMinSizeKB] = useState('1');
  const [mergeMode, setMergeMode] = useState<'delete' | 'hardlink'>('delete');
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [keep, setKeep] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState<DedupProgress | null>(null);

  // Live progress stream from the Rust scanner. Mounted only while the dialog is
  // open so we don't keep a global listener around.
  useEffect(() => {
    if (!open || !isTauri()) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    listen<DedupProgress>('dedup-progress', ev => {
      if (ev.payload.phase === 'done') setProgress(null);
      else setProgress(ev.payload);
    })
      .then(fn => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => void 0);
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [open]);

  const totalWaste = useMemo(() => {
    let sum = 0;
    groups.forEach((g, gi) => {
      const keepIdx = keep[gi] ?? 0;
      const toRemove = g.paths.length - 1;
      if (toRemove > 0 && keepIdx >= 0) sum += g.size * toRemove;
    });
    return sum;
  }, [groups, keep]);

  const toDeleteCount = useMemo(() => {
    let c = 0;
    groups.forEach((g, gi) => {
      const keepIdx = keep[gi] ?? 0;
      if (keepIdx < 0) return;
      c += g.paths.length - 1;
    });
    return c;
  }, [groups, keep]);

  const handleScan = async () => {
    if (!rootFsPath || !isTauri()) return;
    setScanning(true);
    setError(null);
    setProgress({ phase: 'scanning', processed: 0, total: 0 });
    try {
      const min = Math.max(1, Math.floor(Number(minSizeKB) * 1024));
      const result = await findDuplicates(rootFsPath, min);
      setGroups(result);
      setKeep(result.map(() => 0));
      setScanned(true);
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setGroups([]);
      setKeep([]);
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  const handleApply = async () => {
    if (!rootFsPath || !isTauri()) return;
    const deletes: Operation[] = [];
    const links: Operation[] = [];
    groups.forEach((g, gi) => {
      const keepIdx = keep[gi] ?? 0;
      if (keepIdx < 0) return;
      const keepPath = g.paths[keepIdx]!;
      g.paths.forEach((p, pi) => {
        if (pi === keepIdx) return;
        deletes.push({ kind: 'delete', path: p, recursive: false });
        if (mergeMode === 'hardlink') {
          links.push({ kind: 'hardlink', from: keepPath, to: p });
        }
      });
    });
    const ops: Operation[] = [...deletes, ...links];
    if (ops.length === 0) return;
    setApplying(true);
    try {
      const label =
        mergeMode === 'hardlink'
          ? `${t('dedup.applyMerge')} (${deletes.length})`
          : `${t('dedup.applyDelete')} (${deletes.length})`;
      const tx: Transaction = {
        id: 'dedup_' + Date.now().toString(36),
        createdAt: Date.now(),
        label,
        rootFsPath,
        ops,
        inverse: [],
      };
      await applyToDisk(tx);
      setGroups([]);
      setKeep([]);
      setScanned(false);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setApplying(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (applying || scanning) return;
    if (!next) {
      setGroups([]);
      setKeep([]);
      setError(null);
      setScanned(false);
      setProgress(null);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            {t('dedup.title')}
          </DialogTitle>
          <DialogDescription>{t('dedup.description')}</DialogDescription>
        </DialogHeader>

        {!rootFsPath && (
          <div className="text-sm text-muted-foreground">{t('dedup.needFolder')}</div>
        )}

        {rootFsPath && (
          <>
            <div className="flex items-end gap-2 border-b border-border pb-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-muted-foreground">
                  {t('dedup.minSize')}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={minSizeKB}
                  onChange={e => setMinSizeKB(e.target.value)}
                  className="h-8 text-xs font-mono-tight"
                  disabled={scanning || applying}
                />
              </div>
              <Button
                onClick={handleScan}
                disabled={scanning || applying}
                size="sm"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('dedup.scanning')}
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4" />
                    {t('dedup.scan')}
                  </>
                )}
              </Button>
            </div>

            {scanning && progress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono-tight text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {progress.phase === 'scanning'
                      ? t('dedup.phaseScanning')
                      : progress.phase === 'hashing'
                        ? t('dedup.phaseHashing')
                        : t('dedup.phaseVerifying')}
                  </span>
                  <span className="tabular-nums">
                    {progress.total > 0
                      ? `${progress.processed} / ${progress.total}`
                      : `${progress.processed}`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {progress.total > 0 ? (
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-150"
                      style={{
                        width: `${Math.min(100, Math.round((progress.processed / progress.total) * 100))}%`,
                      }}
                    />
                  ) : (
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
                  )}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">{t('dedup.mode')}:</span>
                <Button
                  variant={mergeMode === 'delete' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMergeMode('delete')}
                  disabled={applying}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('dedup.modeDelete')}
                </Button>
                <Button
                  variant={mergeMode === 'hardlink' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMergeMode('hardlink')}
                  disabled={applying}
                  title={t('dedup.modeHardlinkHint')}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {t('dedup.modeHardlink')}
                </Button>
              </div>
            )}

            {error && (
              <div className="text-xs text-destructive break-words">{error}</div>
            )}

            {scanned && !scanning && groups.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('dedup.noResults')}
              </div>
            )}

            {groups.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs font-mono-tight text-muted-foreground">
                  <span>
                    {t('dedup.groups')}:{' '}
                    <strong className="text-foreground">{groups.length}</strong>{' '}
                    · {t('dedup.toDelete')}:{' '}
                    <strong className="text-diff-removed">{toDeleteCount}</strong>
                  </span>
                  <span>
                    {t('dedup.willFree')}:{' '}
                    <strong className="text-diff-added">{formatBytes(totalWaste)}</strong>
                  </span>
                </div>
                <ScrollArea className="max-h-[420px] rounded-md border border-border scrollbar-thin">
                  <ul className="divide-y divide-border">
                    {groups.map((g, gi) => {
                      const keepIdx = keep[gi] ?? 0;
                      return (
                        <li key={g.hash + gi} className="p-2 space-y-1">
                          <div className="flex items-center gap-2 text-[11px] font-mono-tight text-muted-foreground">
                            <Copy className="h-3 w-3" />
                            <span className="uppercase">{g.hash.slice(0, 10)}</span>
                            <span>·</span>
                            <span>{formatBytes(g.size)}</span>
                            <span>·</span>
                            <span className="text-diff-added">
                              -{formatBytes(g.size * (g.paths.length - 1))}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setKeep(k => {
                                  const next = [...k];
                                  next[gi] = next[gi] === -1 ? 0 : -1;
                                  return next;
                                })
                              }
                              className="ml-auto text-[10px] uppercase tracking-wide hover:text-foreground"
                            >
                              {keepIdx === -1 ? t('dedup.restore') : t('dedup.skip')}
                            </button>
                          </div>
                          <ul className="space-y-0.5">
                            {g.paths.map((p, pi) => {
                              const isKeep = keepIdx === pi;
                              const willDelete = keepIdx >= 0 && !isKeep;
                              return (
                                <li key={p} className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                    <input
                                      type="radio"
                                      name={`keep-${gi}`}
                                      checked={isKeep}
                                      onChange={() =>
                                        setKeep(k => {
                                          const next = [...k];
                                          next[gi] = pi;
                                          return next;
                                        })
                                      }
                                      disabled={keepIdx === -1}
                                      className="shrink-0"
                                    />
                                    <MonoText
                                      className="text-xs truncate"
                                      title={p}
                                    >
                                      {shortPath(p, rootFsPath)}
                                    </MonoText>
                                  </label>
                                  <span className="text-[10px] uppercase tracking-wide shrink-0">
                                    {keepIdx === -1 ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : isKeep ? (
                                      <span className="text-diff-added">{t('dedup.keep')}</span>
                                    ) : willDelete ? (
                                      <span className="text-diff-removed">
                                        {t('dedup.toTrash')}
                                      </span>
                                    ) : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </>
            )}
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={applying || scanning}
          >
            {t('common.close')}
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || scanning || toDeleteCount === 0}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('dedup.applying')}
              </>
            ) : mergeMode === 'hardlink' ? (
              <>
                <Link2 className="h-4 w-4" />
                {t('dedup.applyMerge')} ({toDeleteCount})
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {t('dedup.applyDelete')} ({toDeleteCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
