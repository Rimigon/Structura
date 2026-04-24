import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Wand2 } from 'lucide-react';
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
import type { DirNode, FileNode, Operation, Transaction } from '@/types';
import { applyTemplate, TEMPLATE_PRESETS } from '@/core/flatten/renameTemplate';
import { useTreeStore, useUIStore } from '@/stores';
import { extractMetadata, isTauri, type MediaMetadata } from '@/lib/tauri';

interface Row {
  nodeId: string;
  oldName: string;
  newName: string;
  metadata?: MediaMetadata;
  conflict: boolean;
  unchanged: boolean;
}

const METADATA_EXTS = new Set([
  'jpg', 'jpeg', 'tiff', 'tif', 'heic', 'heif', 'webp', 'png',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff',
]);

function isMetaExt(ext: string): boolean {
  return METADATA_EXTS.has(ext.toLowerCase());
}

export function BatchRenameDialog() {
  const targetId = useUIStore(s => s.batchRenameTarget);
  const setTarget = useUIStore(s => s.setBatchRenameTarget);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const applyToDisk = useTreeStore(s => s.applyToDisk);
  const [template, setTemplate] = useState('{exif_date} — {file}');
  const [metaCache, setMetaCache] = useState<Record<string, MediaMetadata>>({});
  const [fetching, setFetching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = targetId !== null;
  const target = targetId ? nodes[targetId] : null;
  const targetDir =
    target && target.kind === 'dir' ? (target as DirNode) : null;

  const files = useMemo(() => {
    if (!targetDir) return [] as FileNode[];
    const out: FileNode[] = [];
    for (const cid of targetDir.childIds) {
      const c = nodes[cid];
      if (c && c.kind === 'file' && c.dirty !== 'deleted') out.push(c as FileNode);
    }
    return out;
  }, [targetDir, nodes]);

  useEffect(() => {
    if (!open || !isTauri() || files.length === 0) return;
    const needsFetch = files.filter(
      f => f.originalPath && isMetaExt(f.ext) && !metaCache[f.id],
    );
    if (needsFetch.length === 0) return;
    let cancelled = false;
    setFetching(true);
    (async () => {
      const next: Record<string, MediaMetadata> = {};
      for (const f of needsFetch) {
        if (cancelled) break;
        try {
          const m = await extractMetadata(f.originalPath!);
          next[f.id] = m;
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        setMetaCache(prev => ({ ...prev, ...next }));
      }
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, files, metaCache]);

  const rows: Row[] = useMemo(() => {
    if (!targetDir) return [];
    const takenNames = new Set<string>();
    for (const cid of targetDir.childIds) {
      const n = nodes[cid];
      if (n && n.kind === 'dir' && n.dirty !== 'deleted') takenNames.add(n.name);
    }
    const newNames = new Map<string, number>();
    const pending: Row[] = [];
    let counter = 1;
    for (const f of files) {
      const meta = metaCache[f.id];
      const tplVars = {
        file: f.name,
        parent: targetDir.name,
        grandparent: targetDir.parentId
          ? nodes[targetDir.parentId]?.name ?? ''
          : '',
        counter: counter++,
        exifDate: meta?.exifDate ?? undefined,
        exifCamera: meta?.exifCamera ?? undefined,
        exifLens: meta?.exifLens ?? undefined,
        exifWidth: meta?.exifWidth ?? undefined,
        exifHeight: meta?.exifHeight ?? undefined,
        id3Artist: meta?.id3Artist ?? undefined,
        id3Title: meta?.id3Title ?? undefined,
        id3Album: meta?.id3Album ?? undefined,
        id3Year: meta?.id3Year ?? undefined,
        id3Track: meta?.id3Track ?? undefined,
      };
      const raw = applyTemplate(template, tplVars);
      const cleaned = raw.replace(/^\s*—\s*/, '').trim() || f.name;
      newNames.set(cleaned, (newNames.get(cleaned) ?? 0) + 1);
      pending.push({
        nodeId: f.id,
        oldName: f.name,
        newName: cleaned,
        metadata: meta,
        conflict: false,
        unchanged: cleaned === f.name,
      });
    }
    for (const r of pending) {
      if (takenNames.has(r.newName) && r.newName !== r.oldName) r.conflict = true;
      if ((newNames.get(r.newName) ?? 0) > 1) r.conflict = true;
    }
    return pending;
  }, [files, metaCache, nodes, targetDir, template]);

  const applicable = rows.filter(r => !r.unchanged && !r.conflict);
  const conflictCount = rows.filter(r => r.conflict).length;

  const handleApply = async () => {
    if (!rootFsPath || applicable.length === 0) return;
    const ops: Operation[] = [];
    for (const r of applicable) {
      const node = nodes[r.nodeId];
      if (!node || !node.originalPath) continue;
      ops.push({ kind: 'rename', path: node.originalPath, newName: r.newName });
    }
    if (ops.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const tx: Transaction = {
        id: 'batchrename_' + Date.now().toString(36),
        createdAt: Date.now(),
        label: `Пакетное переименование по шаблону (${ops.length})`,
        rootFsPath,
        ops,
        inverse: [],
      };
      await applyToDisk(tx);
      setTarget(null);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setApplying(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (applying || fetching) return;
    if (!next) {
      setTarget(null);
      setMetaCache({});
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Пакетное переименование по шаблону
          </DialogTitle>
          <DialogDescription>
            {targetDir ? (
              <>
                Папка: <MonoText className="inline">{targetDir.name}</MonoText> ·{' '}
                Файлов: {files.length}
              </>
            ) : (
              'Целевая папка не выбрана.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Шаблон</label>
          <Input
            value={template}
            onChange={e => setTemplate(e.target.value)}
            className="h-8 font-mono-tight text-xs"
            placeholder="напр. {exif_date} — {file}"
          />
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_PRESETS.map(p => (
              <button
                key={p.template}
                type="button"
                onClick={() => setTemplate(p.template)}
                className="text-[11px] rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Переменные: <code>{'{file}'}</code> <code>{'{base}'}</code>{' '}
            <code>{'{ext}'}</code> <code>{'{parent}'}</code>{' '}
            <code>{'{grandparent}'}</code> <code>{'{counter}'}</code>{' '}
            <code>{'{exif_date}'}</code> <code>{'{exif_camera}'}</code>{' '}
            <code>{'{exif_lens}'}</code> <code>{'{exif_width}'}</code>{' '}
            <code>{'{exif_height}'}</code> <code>{'{id3_artist}'}</code>{' '}
            <code>{'{id3_title}'}</code> <code>{'{id3_album}'}</code>{' '}
            <code>{'{id3_year}'}</code> <code>{'{id3_track}'}</code>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-tight border-t border-border pt-2">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          <span>Будет переименовано: <strong>{applicable.length}</strong></span>
          {conflictCount > 0 && (
            <span className="text-diff-removed flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              конфликтов: {conflictCount}
            </span>
          )}
          {fetching && (
            <span className="flex items-center gap-1 text-muted-foreground ml-auto">
              <Loader2 className="h-3 w-3 animate-spin" />
              метаданные…
            </span>
          )}
        </div>

        {files.length > 0 ? (
          <ScrollArea className="max-h-[420px] rounded-md border border-border scrollbar-thin">
            <ul className="divide-y divide-border">
              {rows.map(r => (
                <li key={r.nodeId} className="p-2 text-[11px] font-mono-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground truncate flex-1" title={r.oldName}>
                      {r.oldName}
                    </span>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <span
                      className={
                        'truncate flex-1 ' +
                        (r.conflict
                          ? 'text-diff-removed'
                          : r.unchanged
                            ? 'text-muted-foreground'
                            : 'text-diff-added')
                      }
                      title={r.newName}
                    >
                      {r.newName}
                    </span>
                  </div>
                  {r.metadata && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                      {[
                        r.metadata.exifDate,
                        r.metadata.exifCamera,
                        r.metadata.id3Artist,
                        r.metadata.id3Title,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            В папке нет файлов для переименования.
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive break-words">{error}</div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={applying || fetching}
          >
            Отмена
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || fetching || applicable.length === 0}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Применение…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Применить ({applicable.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
