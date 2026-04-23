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
import { ConflictDialog } from '@/components/flatten/ConflictDialog';

interface Props {
  targetId: NodeId;
}

const STRATEGY_LABELS: Record<ConflictStrategy, string> = {
  'parent-prefix-then-counter': 'Префикс родителя, затем счётчик',
  'counter-only': 'Только счётчик',
  skip: 'Пропускать',
  overwrite: 'Заменять',
  ask: 'Спрашивать',
};

const MODE_LABELS: Record<FlattenMode, string> = {
  'into-target': 'Свести в эту папку',
  dissolve: 'Схлопнуть (вытащить наружу)',
};

export function FlattenControls({ targetId }: Props) {
  const applyOps = useTreeStore(s => s.applyOps);
  const target = useTreeStore(s =>
    s.nodes[targetId]?.kind === 'dir' ? (s.nodes[targetId] as DirNode) : null,
  );

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
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Операции</div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Режим</label>
        <div className="grid grid-cols-1 gap-1">
          {(Object.keys(MODE_LABELS) as FlattenMode[]).map(m => {
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
                <span className="truncate">{MODE_LABELS[m]}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Стратегия при совпадении имён
        </label>
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value as ConflictStrategy)}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
        >
          {(Object.keys(STRATEGY_LABELS) as ConflictStrategy[]).map(s => (
            <option key={s} value={s}>
              {STRATEGY_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Шаблон имени (необязательно)
        </label>
        <select
          value={template}
          onChange={e => setTemplate(e.target.value)}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
        >
          <option value="">— без изменений</option>
          {TEMPLATE_PRESETS.filter(p => p.template !== '{file}').map(p => (
            <option key={p.template} value={p.template}>
              {p.label} · {p.hint}
            </option>
          ))}
        </select>
        <Input
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder="напр. {parent} — {file}"
          className="h-7 text-xs font-mono-tight"
        />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Переменные: <code>{'{parent}'}</code> <code>{'{file}'}</code>{' '}
          <code>{'{base}'}</code> <code>{'{ext}'}</code>
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Пропускать файлы больше (МБ, пусто = без лимита)
        </label>
        <Input
          type="number"
          min={0}
          value={maxSizeMB}
          onChange={e => setMaxSizeMB(e.target.value)}
          placeholder="например, 1024"
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
        Выполнить
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {mode === 'into-target'
          ? <>Переносит все файлы из поддерева в <strong>{target.name}</strong>. Пустые подкаталоги удаляются.</>
          : <>Вытаскивает содержимое папки <strong>{target.name}</strong> на уровень выше и удаляет саму папку.</>}
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
