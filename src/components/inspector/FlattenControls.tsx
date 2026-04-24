import { useState } from 'react';
import { FolderMinus, Layers } from 'lucide-react';
import {
  DEFAULT_FLATTEN_CONFIG,
  type ConflictStrategy,
  type DirNode,
  type FlattenConfig,
  type FlattenMode,
  type NodeId,
  type PendingConflict,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { flatten } from '@/core/flatten/flatten';
import { TEMPLATE_PRESETS } from '@/core/flatten/renameTemplate';
import { useTreeStore } from '@/stores';
import { useLocale, useT } from '@/lib/i18n';
import { ConflictDialog } from '@/components/flatten/ConflictDialog';

interface Props {
  targetId: NodeId;
}

const STRATEGY_KEY: Record<ConflictStrategy, string> = {
  'parent-prefix-then-counter': 'flatten.strategy.parentPrefix',
  'counter-only': 'flatten.strategy.counterOnly',
  skip: 'flatten.strategy.skip',
  overwrite: 'flatten.strategy.overwrite',
  ask: 'flatten.strategy.ask',
};

const MODE_KEY: Record<FlattenMode, string> = {
  'into-target': 'flatten.mode.intoTarget',
  dissolve: 'flatten.mode.dissolve',
};

export function FlattenControls({ targetId }: Props) {
  const applyOps = useTreeStore(s => s.applyOps);
  const target = useTreeStore(s =>
    s.nodes[targetId]?.kind === 'dir' ? (s.nodes[targetId] as DirNode) : null,
  );
  const t = useT();
  const locale = useLocale();

  const [mode, setMode] = useState<FlattenMode>('into-target');
  const [strategy, setStrategy] = useState<ConflictStrategy>(
    DEFAULT_FLATTEN_CONFIG.conflictStrategy,
  );
  const [maxSizeMB, setMaxSizeMB] = useState<string>('');
  const [template, setTemplate] = useState<string>('');
  const [pending, setPending] = useState<PendingConflict[]>([]);

  if (!target) return null;

  const isRoot = target.parentId === null;

  const cfg: FlattenConfig = {
    mode,
    conflictStrategy: strategy,
    cleanupEmpty: true,
    maxFileSizeBytes:
      maxSizeMB.trim() === '' ? null : Math.max(0, Number(maxSizeMB)) * 1024 * 1024,
    renameTemplate: template.trim() === '' ? null : template.trim(),
  };

  const handleFlatten = () => {
    if (mode === 'dissolve' && isRoot) return;
    const tree = useTreeStore.getState();
    const { tx, pending: p } = flatten(tree, targetId, cfg);
    if (p.length > 0) {
      setPending(p);
      return;
    }
    applyOps(tx.ops);
  };

  const handleResolve = (resolutions: Map<NodeId, import('@/types').ConflictResolution>) => {
    const tree = useTreeStore.getState();
    const { tx } = flatten(tree, targetId, cfg, resolutions);
    applyOps(tx.ops);
    setPending([]);
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('flatten.header')}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('flatten.mode')}</label>
        <div className="grid grid-cols-1 gap-1">
          {(Object.keys(MODE_KEY) as FlattenMode[]).map(m => {
            const disabled = m === 'dissolve' && isRoot;
            return (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                onClick={() => setMode(m)}
                className="justify-start"
              >
                {m === 'into-target' ? (
                  <Layers className="h-3.5 w-3.5" />
                ) : (
                  <FolderMinus className="h-3.5 w-3.5" />
                )}
                <span className="truncate">{t(MODE_KEY[m])}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('flatten.strategy')}</label>
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

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('flatten.template')}</label>
        <select
          value={template}
          onChange={e => setTemplate(e.target.value)}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
        >
          <option value="">{t('flatten.templateNone')}</option>
          {TEMPLATE_PRESETS.filter(p => p.template !== '{file}').map(p => {
            const label = locale === 'en' && p.labelEn ? p.labelEn : p.label;
            const hint = locale === 'en' && p.hintEn ? p.hintEn : p.hint;
            return (
              <option key={p.template} value={p.template}>
                {label} · {hint}
              </option>
            );
          })}
        </select>
        <Input
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder={t('flatten.templatePlaceholder')}
          className="h-7 text-xs font-mono-tight"
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t('flatten.templateVars')}:{' '}
          <code>{'{parent}'}</code> <code>{'{file}'}</code>{' '}
          <code>{'{base}'}</code> <code>{'{ext}'}</code>
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('flatten.maxSize')}</label>
        <Input
          type="number"
          min={0}
          value={maxSizeMB}
          onChange={e => setMaxSizeMB(e.target.value)}
          placeholder={t('flatten.maxSizePlaceholder')}
          className="h-8 text-xs font-mono-tight"
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={handleFlatten}
        disabled={mode === 'dissolve' && isRoot}
      >
        {mode === 'into-target' ? (
          <Layers className="h-4 w-4" />
        ) : (
          <FolderMinus className="h-4 w-4" />
        )}
        {t('flatten.execute')}
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {mode === 'into-target' ? (
          <>
            {t('flatten.intoTargetExplain')} <strong>{target.name}</strong>.{' '}
            {t('flatten.emptyDirsRemoved')}
          </>
        ) : (
          <>
            {t('flatten.dissolveExplain')} <strong>{target.name}</strong>{' '}
            {t('flatten.dissolveSuffix')}
          </>
        )}
      </p>

      <ConflictDialog
        open={pending.length > 0}
        conflicts={pending}
        onResolve={handleResolve}
        onCancel={() => setPending([])}
      />
    </div>
  );
}
