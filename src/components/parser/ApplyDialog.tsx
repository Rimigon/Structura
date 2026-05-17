import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderTree,
  HardDrive,
  Layers,
  Loader2,
  Move,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
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
import { summarize } from '@/core/diff';
import { diffFromDirtyFlags } from '@/core/diff/computeDiff';
import { estimateBytes } from '@/core/transaction/estimate';
import { useTreeStore, useUIStore } from '@/stores';
import type { DiffEntry, Operation, TreeState, Transaction, TxResult } from '@/types';
import { checkDiskSpace, isTauri, type DiskCheck } from '@/lib/tauri';
import { useT } from '@/lib/i18n';

type DiffKind = DiffEntry['kind'];
type FilterKind = 'all' | 'added' | 'moved' | 'renamed' | 'removed';

const KIND_ICON: Record<Exclude<DiffKind, 'unchanged'>, typeof Plus> = {
  added: Plus,
  removed: Trash2,
  renamed: Pencil,
  moved: Move,
};

const KIND_CLASS: Record<FilterKind, string> = {
  all: 'text-foreground',
  added: 'text-diff-added',
  removed: 'text-diff-removed',
  renamed: 'text-diff-renamed',
  moved: 'text-diff-moved',
};

const KIND_BG: Record<Exclude<DiffKind, 'unchanged'>, string> = {
  added: 'bg-diff-added/10 border-diff-added/30',
  removed: 'bg-diff-removed/10 border-diff-removed/30',
  renamed: 'bg-diff-renamed/10 border-diff-renamed/30',
  moved: 'bg-diff-moved/10 border-diff-moved/30',
};

function splitPath(p: string): { head: string; tail: string } {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (idx < 0) return { head: '', tail: p };
  return { head: p.slice(0, idx + 1), tail: p.slice(idx + 1) };
}

function commonPrefix(a: string, b: string): string {
  const slashA = Math.max(a.lastIndexOf('/'), a.lastIndexOf('\\'));
  const slashB = Math.max(b.lastIndexOf('/'), b.lastIndexOf('\\'));
  if (slashA < 0 || slashB < 0) return '';
  const limit = Math.min(slashA, slashB);
  let i = 0;
  while (i <= limit && a[i] === b[i]) i++;
  const lastSep = Math.max(
    a.lastIndexOf('/', i - 1),
    a.lastIndexOf('\\', i - 1),
  );
  if (lastSep < 0) return '';
  return a.slice(0, lastSep + 1);
}

function formatBytes(n: number): string {
  if (n <= 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const val = n / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function ApplyDialog() {
  const open = useUIStore(s => s.applyDialogOpen);
  const setOpen = useUIStore(s => s.setApplyDialogOpen);
  const state = useTreeStore();
  const t = useT();

  const diff = useMemo(() => diffFromDirtyFlags(state), [state]);
  const summary = summarize(diff);
  const ops = useMemo(() => opsFromDiff(diff, state), [diff, state]);
  const required = useMemo(() => estimateBytes(state, ops), [state, ops]);

  const [filter, setFilter] = useState<FilterKind>('all');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'kind' | 'dir'>('kind');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );
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

  useEffect(() => {
    if (!open) setResult(null);
  }, [open]);

  const fileCount = useMemo(
    () =>
      diff.filter(e => {
        const n = state.nodes[e.nodeId];
        return n && n.kind === 'file' && e.kind !== 'unchanged';
      }).length,
    [diff, state.nodes],
  );
  const dirCount = useMemo(
    () =>
      diff.filter(e => {
        const n = state.nodes[e.nodeId];
        return n && n.kind === 'dir' && e.kind !== 'unchanged';
      }).length,
    [diff, state.nodes],
  );

  const filteredDiff = useMemo(() => {
    let list = diff.filter(e => e.kind !== 'unchanged');
    if (filter !== 'all') list = list.filter(e => e.kind === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(e => {
        const a = (e.fromPath ?? '').toLowerCase();
        const b = (e.toPath ?? '').toLowerCase();
        return a.includes(q) || b.includes(q);
      });
    }
    return list;
  }, [diff, filter, search]);

  const groupedDiff = useMemo(() => {
    const groups: { key: string; label: string; entries: DiffEntry[] }[] = [];
    if (groupBy === 'kind') {
      const order: Exclude<DiffKind, 'unchanged'>[] = [
        'added',
        'moved',
        'renamed',
        'removed',
      ];
      for (const k of order) {
        const entries = filteredDiff.filter(e => e.kind === k);
        if (entries.length > 0) groups.push({ key: k, label: t(`apply.${k}`), entries });
      }
    } else {
      const byDir = new Map<string, DiffEntry[]>();
      for (const e of filteredDiff) {
        const p = e.toPath ?? e.fromPath ?? '';
        const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
        const dir = idx > 0 ? p.slice(0, idx) : '/';
        const bucket = byDir.get(dir) ?? [];
        bucket.push(e);
        byDir.set(dir, bucket);
      }
      const sortedKeys = Array.from(byDir.keys()).sort();
      for (const k of sortedKeys) {
        groups.push({ key: k, label: k || '/', entries: byDir.get(k)! });
      }
    }
    return groups;
  }, [filteredDiff, groupBy, t]);

  const handleApply = async () => {
    if (!state.rootFsPath) return;
    setBusy(true);
    try {
      const tx: Transaction = {
        id: 'tx_' + Date.now().toString(36),
        createdAt: Date.now(),
        label: t('apply.title'),
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

  const counts: Record<FilterKind, number> = {
    all: summary.total,
    added: summary.added,
    moved: summary.moved,
    renamed: summary.renamed,
    removed: summary.removed,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            {t('apply.title')}
          </DialogTitle>
          <DialogDescription>{t('apply.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Summary metrics cards ------------------------------------------ */}
        {summary.total === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('apply.empty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <MetricCard
                icon={Play}
                label={t('apply.totalOps')}
                value={summary.total}
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                className="text-foreground"
                highlighted
              />
              <MetricCard
                icon={Plus}
                label={t('apply.added')}
                value={summary.added}
                active={filter === 'added'}
                onClick={() => summary.added > 0 && setFilter('added')}
                className="text-diff-added"
              />
              <MetricCard
                icon={Move}
                label={t('apply.moved')}
                value={summary.moved}
                active={filter === 'moved'}
                onClick={() => summary.moved > 0 && setFilter('moved')}
                className="text-diff-moved"
              />
              <MetricCard
                icon={Pencil}
                label={t('apply.renamed')}
                value={summary.renamed}
                active={filter === 'renamed'}
                onClick={() => summary.renamed > 0 && setFilter('renamed')}
                className="text-diff-renamed"
              />
              <MetricCard
                icon={Trash2}
                label={t('apply.removed')}
                value={summary.removed}
                active={filter === 'removed'}
                onClick={() => summary.removed > 0 && setFilter('removed')}
                className="text-diff-removed"
              />
              <MetricCard
                icon={HardDrive}
                label={t('apply.estSize')}
                value={formatBytes(Math.max(0, Math.ceil(required)))}
                className="text-muted-foreground"
              />
            </div>

            {/* File / dir breakdown + group toggle + search ---------------- */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono-tight flex-wrap">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {t('apply.files')}: <strong className="text-foreground">{fileCount}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Folder className="h-3 w-3" />
                {t('apply.dirs')}: <strong className="text-foreground">{dirCount}</strong>
              </span>
              <span className="text-[10px] uppercase tracking-wide ml-2">
                {filter === 'all' ? t('apply.showAll') : t(`apply.${filter}`)}:{' '}
                <strong className="text-foreground">{counts[filter]}</strong>
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant={groupBy === 'kind' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setGroupBy('kind')}
                  aria-pressed={groupBy === 'kind'}
                >
                  <Layers className="h-3 w-3" />
                  {t('apply.groupByKind')}
                </Button>
                <Button
                  type="button"
                  variant={groupBy === 'dir' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setGroupBy('dir')}
                  aria-pressed={groupBy === 'dir'}
                >
                  <FolderTree className="h-3 w-3" />
                  {t('apply.groupByDir')}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('apply.searchPlaceholder')}
                className="h-7 pl-7 text-xs font-mono-tight"
              />
            </div>

            {/* Operation list ---------------------------------------------- */}
            <ScrollArea className="h-[320px] rounded-md border border-border p-1 scrollbar-thin">
              {filteredDiff.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {t('apply.empty')}
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedDiff.map(group => {
                    const collapsed = collapsedGroups[group.key] ?? false;
                    return (
                      <section key={group.key}>
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedGroups(prev => ({
                              ...prev,
                              [group.key]: !collapsed,
                            }))
                          }
                          className="sticky top-0 z-10 w-full flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wide bg-card/95 backdrop-blur border-b border-border/60 hover:bg-card font-mono-tight"
                        >
                          {collapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          <span className="text-foreground truncate" title={group.label}>
                            {group.label}
                          </span>
                          <span className="ml-auto text-muted-foreground">
                            {group.entries.length}
                          </span>
                        </button>
                        {!collapsed && (
                          <ul className="space-y-1 py-1">
                            {group.entries.map(entry => (
                              <OperationRow
                                key={entry.nodeId}
                                entry={entry}
                                state={state}
                                t={t}
                              />
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Disk space banner ---------------------------------------------- */}
        {disk && summary.total > 0 && (
          <div
            className={
              'rounded-md border p-2 text-xs font-mono-tight flex items-center gap-2 ' +
              (disk.sufficient
                ? 'border-border bg-card/60 text-muted-foreground'
                : 'border-destructive/60 bg-destructive/10 text-destructive')
            }
          >
            {disk.sufficient ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-diff-added" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {disk.sufficient ? t('apply.diskOk') : t('apply.diskInsufficient')}.{' '}
              {t('apply.diskRequired')}: {formatBytes(disk.required)}{' · '}
              {t('apply.diskAvailable')}: {formatBytes(disk.available)}
            </span>
          </div>
        )}
        {diskError && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs font-mono-tight text-destructive">
            {t('apply.diskCheckFailed')}: {diskError}
          </div>
        )}

        {/* Result ---------------------------------------------------------- */}
        {result && (
          <div className="rounded-md border border-border bg-card/60 p-2 text-xs font-mono-tight flex items-center gap-3">
            <span className="flex items-center gap-1 text-diff-added">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('apply.success')}: {result.results.filter(r => r.status === 'ok').length}
            </span>
            <span className="flex items-center gap-1 text-diff-removed">
              <XCircle className="h-3.5 w-3.5" />
              {t('apply.errors')}: {result.results.filter(r => r.status === 'error').length}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              {t('apply.skipped')}: {result.results.filter(r => r.status === 'skipped').length}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
          <Button
            onClick={handleApply}
            disabled={busy || summary.total === 0 || disk?.sufficient === false}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('apply.applying')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {t('common.apply')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  active,
  onClick,
  className,
  highlighted,
}: {
  icon: typeof Plus;
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  highlighted?: boolean;
}) {
  const disabled = typeof value === 'number' && value === 0 && !highlighted;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition-all ' +
        (active
          ? 'border-primary bg-primary/10 shadow-inner'
          : 'border-border hover:border-primary/40') +
        (disabled ? ' opacity-40 cursor-default' : ' cursor-pointer')
      }
    >
      <div className={'flex items-center gap-1 ' + (className ?? '')}>
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={'text-base font-mono-tight font-semibold ' + (className ?? '')}>
        {value}
      </div>
    </button>
  );
}

function OperationRow({
  entry,
  state,
  t,
}: {
  entry: DiffEntry;
  state: TreeState;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (entry.kind === 'unchanged') return null;
  const Icon = KIND_ICON[entry.kind];
  const node = state.nodes[entry.nodeId];
  const isDir = node?.kind === 'dir';
  const NodeIcon = isDir ? Folder : FileText;

  if (entry.kind === 'moved' || entry.kind === 'renamed') {
    const from = entry.fromPath ?? '';
    const to = entry.toPath ?? '';
    const shared = commonPrefix(from, to);
    const fromRel = shared ? from.slice(shared.length) : from;
    const toRel = shared ? to.slice(shared.length) : to;
    return (
      <li
        className={
          'rounded border px-2 py-1.5 text-[11px] font-mono-tight flex items-start gap-2 ' +
          KIND_BG[entry.kind]
        }
      >
        <div className={'flex items-center gap-1 shrink-0 ' + KIND_CLASS[entry.kind]}>
          <Icon className="h-3 w-3" />
          <NodeIcon className="h-3 w-3" />
          <span className="uppercase tracking-wide text-[10px]">
            {t(`apply.${entry.kind}`)}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          {shared && (
            <div className="text-[10px] text-muted-foreground truncate" title={shared}>
              {shared}
            </div>
          )}
          <div className="flex items-center gap-2">
            <MonoText className="flex-1 truncate text-diff-removed/80" title={from}>
              {fromRel || '—'}
            </MonoText>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <MonoText className="flex-1 truncate text-diff-added/90" title={to}>
              {toRel || '—'}
            </MonoText>
          </div>
        </div>
      </li>
    );
  }

  // added or removed
  const path = entry.toPath ?? entry.fromPath ?? '';
  const { head, tail } = splitPath(path);
  return (
    <li
      className={
        'rounded border px-2 py-1.5 text-[11px] font-mono-tight flex items-center gap-2 ' +
        KIND_BG[entry.kind]
      }
    >
      <div className={'flex items-center gap-1 shrink-0 ' + KIND_CLASS[entry.kind]}>
        <Icon className="h-3 w-3" />
        <NodeIcon className="h-3 w-3" />
        <span className="uppercase tracking-wide text-[10px]">
          {t(`apply.${entry.kind}`)}
        </span>
      </div>
      <MonoText className="flex-1 truncate" title={path}>
        <span className="text-muted-foreground">{head}</span>
        <span className={KIND_CLASS[entry.kind === 'added' ? 'added' : 'removed']}>
          {tail}
        </span>
      </MonoText>
    </li>
  );
}

function opsFromDiff(
  diff: ReturnType<typeof diffFromDirtyFlags>,
  state: TreeState,
): Operation[] {
  const ops: Operation[] = [];
  const copyRootIds = new Set<string>();
  for (const entry of diff) {
    if (entry.kind === 'added' && entry.toPath) {
      const n = state.nodes[entry.nodeId];
      if (!n) continue;
      if (n.copiedFrom) {
        copyRootIds.add(entry.nodeId);
        ops.push({
          kind: 'copy',
          from: n.copiedFrom,
          to: entry.toPath,
          recursive: n.kind === 'dir',
        });
        continue;
      }
      if (hasCopyAncestor(state, entry.nodeId, copyRootIds)) continue;
      if (n.kind === 'file') {
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

function hasCopyAncestor(
  state: TreeState,
  id: string,
  copyRoots: Set<string>,
): boolean {
  let cur = state.nodes[id]?.parentId ?? null;
  while (cur) {
    if (copyRoots.has(cur)) return true;
    cur = state.nodes[cur]?.parentId ?? null;
  }
  return false;
}

function orderOps(ops: Operation[]): Operation[] {
  const mkdirs: Operation[] = [];
  const touches: Operation[] = [];
  const copies: Operation[] = [];
  const renames: Operation[] = [];
  const moves: Operation[] = [];
  const deletes: Operation[] = [];
  const links: Operation[] = [];
  for (const op of ops) {
    if (op.kind === 'mkdir') mkdirs.push(op);
    else if (op.kind === 'touch') touches.push(op);
    else if (op.kind === 'copy') copies.push(op);
    else if (op.kind === 'rename') renames.push(op);
    else if (op.kind === 'move') moves.push(op);
    else if (op.kind === 'delete') deletes.push(op);
    else if (op.kind === 'hardlink' || op.kind === 'symlink') links.push(op);
  }
  mkdirs.sort((a, b) => pathOf(a).length - pathOf(b).length);
  touches.sort((a, b) => pathOf(a).length - pathOf(b).length);
  copies.sort((a, b) => pathOf(a).length - pathOf(b).length);
  deletes.sort((a, b) => pathOf(b).length - pathOf(a).length);
  return [...mkdirs, ...touches, ...copies, ...renames, ...moves, ...deletes, ...links];
}

function pathOf(op: Operation): string {
  if ('path' in op) return op.path;
  return op.to;
}
