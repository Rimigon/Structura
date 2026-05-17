import { useEffect, useMemo, useState } from 'react';
import { Eye, FileSearch, Layers, Wand2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DEFAULT_DEDUP_CONFIG,
  DEFAULT_FLATTEN_CONFIG,
  DEFAULT_RENAME_CONFIG,
  type ConflictStrategy,
  type DedupAction,
  type NodeId,
  type Operation,
  type Preset,
  type PresetConfig,
  type PresetKind,
  type RenameScope,
  type RenameTarget,
  type TreeNode,
} from '@/types';
import { usePresetStore, useSelectionStore, useTreeStore } from '@/stores';
import { applyPreset } from '@/core/preset';
import { useT } from '@/lib/i18n';

interface Props {
  open: boolean;
  initial?: Preset;
  onClose: () => void;
}

const STRATEGY_KEY: Record<ConflictStrategy, string> = {
  'parent-prefix-then-counter': 'flatten.strategy.parentPrefix',
  'counter-only': 'flatten.strategy.counterOnly',
  skip: 'flatten.strategy.skip',
  overwrite: 'flatten.strategy.overwrite',
  ask: 'flatten.strategy.ask',
};

const KIND_ICON: Record<PresetKind, typeof Layers> = {
  flatten: Layers,
  rename: Wand2,
  dedup: FileSearch,
};

function makeId(): string {
  return 'preset_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function PresetEditor({ open, initial, onClose }: Props) {
  const upsert = usePresetStore(s => s.upsert);
  const t = useT();

  const [kind, setKind] = useState<PresetKind>(initial?.config.kind ?? 'flatten');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));

  // Flatten
  const [strategy, setStrategy] = useState<ConflictStrategy>(
    DEFAULT_FLATTEN_CONFIG.conflictStrategy,
  );
  const [maxSizeMB, setMaxSizeMB] = useState('');
  const [cleanupEmpty, setCleanupEmpty] = useState(true);

  // Rename
  const [template, setTemplate] = useState(DEFAULT_RENAME_CONFIG.template);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>('files');
  const [renameScope, setRenameScope] = useState<RenameScope>('children');

  // Dedup
  const [dedupMinKB, setDedupMinKB] = useState(
    String(DEFAULT_DEDUP_CONFIG.minSizeBytes / 1024),
  );
  const [dedupAction, setDedupAction] = useState<DedupAction>(
    DEFAULT_DEDUP_CONFIG.autoAction,
  );

  useEffect(() => {
    if (!open) return;
    setKind(initial?.config.kind ?? 'flatten');
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setTagsInput((initial?.tags ?? []).join(', '));
    const c = initial?.config;
    if (c?.kind === 'flatten') {
      setStrategy(c.flatten.conflictStrategy);
      const v = c.flatten.maxFileSizeBytes;
      setMaxSizeMB(v ? String(Math.round(v / 1024 / 1024)) : '');
      setCleanupEmpty(c.flatten.cleanupEmpty);
    } else {
      setStrategy(DEFAULT_FLATTEN_CONFIG.conflictStrategy);
      setMaxSizeMB('');
      setCleanupEmpty(true);
    }
    if (c?.kind === 'rename') {
      setTemplate(c.rename.template);
      setRenameTarget(c.rename.targetKind);
      setRenameScope(c.rename.scope);
    } else {
      setTemplate(DEFAULT_RENAME_CONFIG.template);
      setRenameTarget(DEFAULT_RENAME_CONFIG.targetKind);
      setRenameScope(DEFAULT_RENAME_CONFIG.scope);
    }
    if (c?.kind === 'dedup') {
      setDedupMinKB(String(Math.max(0, Math.round(c.dedup.minSizeBytes / 1024))));
      setDedupAction(c.dedup.autoAction);
    } else {
      setDedupMinKB(String(DEFAULT_DEDUP_CONFIG.minSizeBytes / 1024));
      setDedupAction(DEFAULT_DEDUP_CONFIG.autoAction);
    }
  }, [open, initial]);

  const draftConfig: PresetConfig = useMemo(() => {
    if (kind === 'flatten') {
      return {
        kind: 'flatten',
        flatten: {
          conflictStrategy: strategy,
          cleanupEmpty,
          maxFileSizeBytes:
            maxSizeMB.trim() === ''
              ? null
              : Math.max(0, Number(maxSizeMB)) * 1024 * 1024,
        },
      };
    }
    if (kind === 'rename') {
      return {
        kind: 'rename',
        rename: { template, targetKind: renameTarget, scope: renameScope },
      };
    }
    return {
      kind: 'dedup',
      dedup: {
        minSizeBytes: Math.max(0, Number(dedupMinKB || '0')) * 1024,
        autoAction: dedupAction,
      },
    };
  }, [
    kind,
    strategy,
    cleanupEmpty,
    maxSizeMB,
    template,
    renameTarget,
    renameScope,
    dedupMinKB,
    dedupAction,
  ]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const tags = tagsInput
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    const preset: Preset = {
      id: initial?.id ?? makeId(),
      name: trimmedName,
      description: description.trim() || undefined,
      tags,
      createdAt: initial?.createdAt ?? 0,
      updatedAt: Date.now(),
      config: draftConfig,
    };
    await upsert(preset);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>
            {initial ? t('presetEditor.titleEdit') : t('presetEditor.titleNew')}
          </DialogTitle>
          <DialogDescription>{t('presetEditor.description')}</DialogDescription>
        </DialogHeader>

        {/* Kind selector ------------------------------------------------ */}
        <div className="px-6 pb-2 flex gap-1 shrink-0">
          {(['flatten', 'rename', 'dedup'] as PresetKind[]).map(k => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  'flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ' +
                  (kind === k
                    ? 'bg-primary/10 border-primary text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/60')
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`presetEditor.kind.${k}`)}
              </button>
            );
          })}
        </div>

        <ScrollArea className="flex-1 px-6 pb-3 scrollbar-thin">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">
                {t('presetEditor.name')}
              </label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {t('presetEditor.desc')}
              </label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {t('presetEditor.tags')}
              </label>
              <Input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
              />
            </div>

            {kind === 'flatten' && (
              <FlattenFields
                strategy={strategy}
                setStrategy={setStrategy}
                maxSizeMB={maxSizeMB}
                setMaxSizeMB={setMaxSizeMB}
                cleanupEmpty={cleanupEmpty}
                setCleanupEmpty={setCleanupEmpty}
                t={t}
              />
            )}
            {kind === 'rename' && (
              <RenameFields
                template={template}
                setTemplate={setTemplate}
                target={renameTarget}
                setTarget={setRenameTarget}
                scope={renameScope}
                setScope={setRenameScope}
                t={t}
              />
            )}
            {kind === 'dedup' && (
              <DedupFields
                minKB={dedupMinKB}
                setMinKB={setDedupMinKB}
                action={dedupAction}
                setAction={setDedupAction}
                t={t}
              />
            )}

            <PreviewSection draft={draftConfig} t={t} />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {t('presetEditor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlattenFields({
  strategy,
  setStrategy,
  maxSizeMB,
  setMaxSizeMB,
  cleanupEmpty,
  setCleanupEmpty,
  t,
}: {
  strategy: ConflictStrategy;
  setStrategy: (v: ConflictStrategy) => void;
  maxSizeMB: string;
  setMaxSizeMB: (v: string) => void;
  cleanupEmpty: boolean;
  setCleanupEmpty: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('flatten.strategy')}
        </label>
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value as ConflictStrategy)}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
        >
          {(Object.keys(STRATEGY_KEY) as ConflictStrategy[]).map(s => (
            <option key={s} value={s}>
              {t(STRATEGY_KEY[s])}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.maxSize')}
        </label>
        <Input
          type="number"
          min={0}
          value={maxSizeMB}
          onChange={e => setMaxSizeMB(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={cleanupEmpty}
          onChange={e => setCleanupEmpty(e.target.checked)}
        />
        {t('presetEditor.cleanupEmpty')}
      </label>
    </>
  );
}

function RenameFields({
  template,
  setTemplate,
  target,
  setTarget,
  scope,
  setScope,
  t,
}: {
  template: string;
  setTemplate: (v: string) => void;
  target: RenameTarget;
  setTarget: (v: RenameTarget) => void;
  scope: RenameScope;
  setScope: (v: RenameScope) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.template')}
        </label>
        <Input
          value={template}
          onChange={e => setTemplate(e.target.value)}
          className="font-mono-tight text-xs"
          placeholder="{n:02} — {file}"
        />
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          <code>{'{file}'}</code> <code>{'{name}'}</code> <code>{'{ext}'}</code>{' '}
          <code>{'{parent}'}</code> <code>{'{n}'}</code> <code>{'{n:02}'}</code>{' '}
          <code>{'{date}'}</code> <code>{'{year}'}</code>
        </p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.renameTarget')}
        </label>
        <div className="flex gap-1">
          {(['files', 'dirs', 'both'] as RenameTarget[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setTarget(k)}
              className={
                'flex-1 rounded-md border px-2 py-1 text-xs transition-colors ' +
                (target === k
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/60')
              }
            >
              {t(`presetEditor.renameTarget.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.renameScope')}
        </label>
        <div className="flex gap-1">
          {(['children', 'descendants'] as RenameScope[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={
                'flex-1 rounded-md border px-2 py-1 text-xs transition-colors ' +
                (scope === k
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/60')
              }
            >
              {t(`presetEditor.renameScope.${k}`)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DedupFields({
  minKB,
  setMinKB,
  action,
  setAction,
  t,
}: {
  minKB: string;
  setMinKB: (v: string) => void;
  action: DedupAction;
  setAction: (v: DedupAction) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.dedupMinSize')}
        </label>
        <Input
          type="number"
          min={0}
          value={minKB}
          onChange={e => setMinKB(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">
          {t('presetEditor.dedupAction')}
        </label>
        <select
          value={action}
          onChange={e => setAction(e.target.value as DedupAction)}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
        >
          <option value="mark">{t('presetEditor.dedup.mark')}</option>
          <option value="keepNewest">{t('presetEditor.dedup.keepNewest')}</option>
          <option value="keepOldest">{t('presetEditor.dedup.keepOldest')}</option>
        </select>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug rounded-md border border-border/60 p-2">
        {t('presetEditor.dedupNote')}
      </p>
    </>
  );
}

function PreviewSection({
  draft,
  t,
}: {
  draft: PresetConfig;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const focusedId = useSelectionStore(s => s.focusedId);
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);

  const ops = useMemo(() => {
    if (draft.kind === 'dedup') return [];
    const target = focusedId ?? rootId;
    if (!target) return [];
    return applyPreset(
      useTreeStore.getState(),
      {
        id: 'preview',
        name: 'preview',
        config: draft,
        tags: [],
        createdAt: 0,
        updatedAt: 0,
      },
      target,
    );
  }, [draft, focusedId, rootId]);

  const samples = ops.slice(0, 5);

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Eye className="h-3.5 w-3.5 text-primary" />
        {t('presetEditor.preview')}
      </div>
      {draft.kind === 'dedup' ? (
        <p className="text-[11px] text-muted-foreground">
          {t('presetEditor.dedupPreviewNote')}
        </p>
      ) : !rootId ? (
        <p className="text-[11px] text-muted-foreground">
          {t('presetEditor.previewNoRoot')}
        </p>
      ) : ops.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t('presetEditor.previewEmpty')}
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            {t('presetEditor.previewSummary', { n: ops.length })}
          </p>
          <ul className="space-y-0.5 font-mono-tight text-[10px]">
            {samples.map((op, i) => (
              <li key={i} className="truncate text-foreground/85" title={describeOp(op, nodes)}>
                {describeOp(op, nodes)}
              </li>
            ))}
            {ops.length > samples.length && (
              <li className="text-muted-foreground italic">
                {t('presetEditor.previewMore', { n: ops.length - samples.length })}
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function describeOp(op: Operation, _nodes: Record<NodeId, TreeNode>): string {
  switch (op.kind) {
    case 'rename':
      return `${shortPath(op.path)} → ${op.newName}`;
    case 'move':
      return `${shortPath(op.from)} → ${shortPath(op.to)}`;
    case 'mkdir':
      return `+ ${shortPath(op.path)}`;
    case 'touch':
      return `+ ${shortPath(op.path)}`;
    case 'copy':
      return `${shortPath(op.from)} ⇒ ${shortPath(op.to)}`;
    case 'delete':
      return `− ${shortPath(op.path)}`;
    case 'hardlink':
    case 'symlink':
      return `${shortPath(op.from)} ↔ ${shortPath(op.to)}`;
  }
}

function shortPath(p: string): string {
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return '…/' + parts.slice(-2).join('/');
}
