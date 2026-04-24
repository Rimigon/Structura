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
import { MonoText } from '@/components/common/MonoText';
import type { DirNode, FileNode, NodeId, Operation, TreeNode, Transaction } from '@/types';
import {
  applyTemplate,
  CATEGORY_ORDER,
  TEMPLATE_PRESETS,
  type TemplateCategory,
  type TemplatePreset,
} from '@/core/flatten/renameTemplate';
import { useTreeStore, useUIStore } from '@/stores';
import { useLocale, useT } from '@/lib/i18n';
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

function extOf(name: string): string {
  const m = /\.[^.]+$/.exec(name);
  return m ? m[0].slice(1) : '';
}

export function BatchRenameDialog() {
  const targetId = useUIStore(s => s.batchRenameTarget);
  const selectionIds = useUIStore(s => s.batchRenameSelection);
  const setTarget = useUIStore(s => s.setBatchRenameTarget);
  const setSelection = useUIStore(s => s.setBatchRenameSelection);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const applyToDisk = useTreeStore(s => s.applyToDisk);
  const t = useT();
  const locale = useLocale();

  const [template, setTemplate] = useState('{exif_date} — {file}');
  const [metaCache, setMetaCache] = useState<Record<string, MediaMetadata>>({});
  const [fetching, setFetching] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: 'folder' | 'selection' = selectionIds && selectionIds.length > 0 ? 'selection' : 'folder';
  const open = targetId !== null || mode === 'selection';

  const target = targetId ? nodes[targetId] : null;
  const targetDir = target && target.kind === 'dir' ? (target as DirNode) : null;

  // Collect the node list to rename.
  const targetsForRename: TreeNode[] = useMemo(() => {
    if (mode === 'selection' && selectionIds) {
      const list: TreeNode[] = [];
      for (const id of selectionIds) {
        const n = nodes[id];
        if (n && n.dirty !== 'deleted') list.push(n);
      }
      return list;
    }
    if (!targetDir) return [];
    const out: FileNode[] = [];
    for (const cid of targetDir.childIds) {
      const c = nodes[cid];
      if (c && c.kind === 'file' && c.dirty !== 'deleted') out.push(c as FileNode);
    }
    return out;
  }, [mode, selectionIds, targetDir, nodes]);

  // Fetch metadata for files that support EXIF/ID3 — in both modes.
  useEffect(() => {
    if (!open || !isTauri() || targetsForRename.length === 0) return;
    const needsFetch: TreeNode[] = [];
    for (const n of targetsForRename) {
      if (n.kind !== 'file') continue;
      const f = n as FileNode;
      if (!f.originalPath) continue;
      if (!isMetaExt(f.ext)) continue;
      if (metaCache[f.id]) continue;
      needsFetch.push(f);
    }
    if (needsFetch.length === 0) return;
    let cancelled = false;
    setFetching(true);
    (async () => {
      const next: Record<string, MediaMetadata> = {};
      for (const n of needsFetch) {
        if (cancelled) break;
        const f = n as FileNode;
        try {
          const m = await extractMetadata(f.originalPath!);
          next[f.id] = m;
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setMetaCache(prev => ({ ...prev, ...next }));
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetsForRename, metaCache]);

  const rows: Row[] = useMemo(() => {
    if (targetsForRename.length === 0) return [];
    // Per-sibling "taken names" sets, one per distinct parent, to catch real conflicts.
    const takenByParent = new Map<NodeId, Set<string>>();
    const ensureParentSet = (parentId: NodeId) => {
      let s = takenByParent.get(parentId);
      if (!s) {
        s = new Set<string>();
        const parent = nodes[parentId];
        if (parent && parent.kind === 'dir') {
          for (const cid of (parent as DirNode).childIds) {
            const ch = nodes[cid];
            if (ch && ch.dirty !== 'deleted') s.add(ch.name);
          }
        }
        takenByParent.set(parentId, s);
      }
      return s;
    };

    const newNamesByParent = new Map<NodeId, Map<string, number>>();
    const pending: Row[] = [];
    let counter = 1;
    for (const n of targetsForRename) {
      const parentId = n.parentId;
      if (!parentId) continue;
      const parent = nodes[parentId];
      const grand = parent?.parentId ? nodes[parent.parentId] : null;
      const meta = n.kind === 'file' ? metaCache[n.id] : undefined;
      const file = n.name;
      const ext = n.kind === 'file' ? '.' + (n as FileNode).ext : '';
      // If the template references {ext} but node has no ext we still substitute empty.
      const tplVars = {
        file: file,
        parent: parent?.name ?? '',
        grandparent: grand?.name ?? '',
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
      const cleaned = raw.replace(/^\s*—\s*/, '').trim() || file;
      // If template didn't reference the extension and the original had one,
      // preserve it to avoid accidentally stripping `.jpg`, `.pdf`, etc.
      const finalName =
        !/\{ext\}/.test(template) && ext && !cleaned.toLowerCase().endsWith(ext.toLowerCase())
          ? cleaned + ext
          : cleaned;
      const pMap = newNamesByParent.get(parentId) ?? new Map<string, number>();
      pMap.set(finalName, (pMap.get(finalName) ?? 0) + 1);
      newNamesByParent.set(parentId, pMap);
      pending.push({
        nodeId: n.id,
        oldName: file,
        newName: finalName,
        metadata: meta,
        conflict: false,
        unchanged: finalName === file,
      });
    }

    for (const r of pending) {
      const node = nodes[r.nodeId];
      if (!node?.parentId) continue;
      const taken = ensureParentSet(node.parentId);
      if (taken.has(r.newName) && r.newName !== r.oldName) r.conflict = true;
      const map = newNamesByParent.get(node.parentId);
      if (map && (map.get(r.newName) ?? 0) > 1) r.conflict = true;
    }
    return pending;
  }, [targetsForRename, metaCache, nodes, template]);

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
        label:
          mode === 'selection'
            ? `${t('rename.title')} (${ops.length})`
            : `${t('rename.title')} — ${targetDir?.name ?? ''} (${ops.length})`,
        rootFsPath,
        ops,
        inverse: [],
      };
      await applyToDisk(tx);
      setTarget(null);
      setSelection(null);
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
      setSelection(null);
      setMetaCache({});
      setError(null);
    }
  };

  const presetsByCategory = useMemo(() => {
    const m = new Map<TemplateCategory, TemplatePreset[]>();
    for (const cat of CATEGORY_ORDER) m.set(cat, []);
    for (const p of TEMPLATE_PRESETS) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return m;
  }, []);

  const labelOf = (p: TemplatePreset) =>
    locale === 'en' && p.labelEn ? p.labelEn : p.label;
  const hintOf = (p: TemplatePreset) =>
    locale === 'en' && p.hintEn ? p.hintEn : p.hint;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {t('rename.title')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'selection' ? (
              <>
                {t('rename.description.selection')} ·{' '}
                {t('rename.description.selectedCount')}: {targetsForRename.length}
              </>
            ) : targetDir ? (
              <>
                {t('rename.description.folder')}:{' '}
                <MonoText className="inline">{targetDir.name}</MonoText> ·{' '}
                {t('rename.description.files')}: {targetsForRename.length}
              </>
            ) : (
              t('rename.target.missing')
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-2 shrink-0">
          <label className="text-xs text-muted-foreground">{t('rename.template')}</label>
          <Input
            value={template}
            onChange={e => setTemplate(e.target.value)}
            className="h-9 font-mono-tight text-xs"
            placeholder={t('rename.templatePlaceholder')}
          />

          <div className="border border-border rounded-md">
            <div className="px-2 py-1 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground flex items-center justify-between">
              <span>{t('rename.presets')}</span>
            </div>
            <div className="h-[180px] overflow-y-auto scrollbar-thin">
              <div className="divide-y divide-border">
                {CATEGORY_ORDER.map(cat => {
                  const list = presetsByCategory.get(cat) ?? [];
                  if (list.length === 0) return null;
                  return (
                    <div key={cat} className="py-1.5 px-2">
                      <div className="text-[10px] uppercase tracking-wider text-primary/80 mb-1 font-semibold">
                        {t(`rename.categories.${cat}`)}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {list.map(p => (
                          <button
                            key={p.template}
                            type="button"
                            onClick={() => setTemplate(p.template)}
                            className={
                              'flex items-baseline justify-between rounded px-2 py-1 text-left transition-colors ' +
                              (template === p.template
                                ? 'bg-primary/15 text-foreground'
                                : 'hover:bg-muted')
                            }
                          >
                            <span className="text-[12px]">{labelOf(p)}</span>
                            <span className="text-[10px] text-muted-foreground font-mono-tight ml-2 truncate">
                              {hintOf(p)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug">
            {t('rename.variables')}:{' '}
            <code>{'{file}'}</code> <code>{'{name}'}</code>{' '}
            <code>{'{base}'}</code> <code>{'{ext}'}</code>{' '}
            <code>{'{parent}'}</code> <code>{'{grandparent}'}</code>{' '}
            <code>{'{n}'}</code> <code>{'{n:02}'}</code> <code>{'{n:03}'}</code>{' '}
            <code>{'{n:04}'}</code> <code>{'{date}'}</code> <code>{'{datetime}'}</code>{' '}
            <code>{'{year}'}</code> <code>{'{month}'}</code> <code>{'{day}'}</code>{' '}
            <code>{'{exif_date}'}</code> <code>{'{exif_camera}'}</code>{' '}
            <code>{'{exif_lens}'}</code> <code>{'{exif_width}'}</code>{' '}
            <code>{'{exif_height}'}</code> <code>{'{id3_artist}'}</code>{' '}
            <code>{'{id3_title}'}</code> <code>{'{id3_album}'}</code>{' '}
            <code>{'{id3_year}'}</code> <code>{'{id3_track}'}</code>
          </p>
        </div>

        <div className="px-6 mt-2 flex items-center gap-2 text-xs font-mono-tight border-t border-border pt-2 shrink-0">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          <span>{t('rename.counter')}: <strong>{applicable.length}</strong></span>
          {conflictCount > 0 && (
            <span className="text-diff-removed flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('rename.conflicts')}: {conflictCount}
            </span>
          )}
          {fetching && (
            <span className="flex items-center gap-1 text-muted-foreground ml-auto">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('rename.metaFetching')}
            </span>
          )}
        </div>

        <div className="px-6 mt-2 flex-1 min-h-0 overflow-hidden">
          {rows.length > 0 ? (
            <div className="h-full overflow-y-auto rounded-md border border-border scrollbar-thin">
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
                      {extOf(r.oldName) && (
                        <span className="shrink-0 text-[10px] rounded border border-border px-1 py-0.5 text-muted-foreground">
                          .{extOf(r.oldName)}
                        </span>
                      )}
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
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('rename.target.empty')}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 text-xs text-destructive break-words shrink-0">{error}</div>
        )}

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={applying || fetching}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || fetching || applicable.length === 0}
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('rename.applying')}
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                {t('rename.applyN', { n: applicable.length })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
