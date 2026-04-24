import { useEffect, useState } from 'react';
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
import {
  DEFAULT_FLATTEN_CONFIG,
  type Preset,
  type ConflictStrategy,
} from '@/types';
import { usePresetStore } from '@/stores';
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

function makeId(): string {
  return 'preset_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function PresetEditor({ open, initial, onClose }: Props) {
  const upsert = usePresetStore(s => s.upsert);
  const t = useT();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [strategy, setStrategy] = useState<ConflictStrategy>(
    initial?.config.kind === 'flatten'
      ? initial.config.flatten.conflictStrategy
      : DEFAULT_FLATTEN_CONFIG.conflictStrategy,
  );
  const [maxSizeMB, setMaxSizeMB] = useState(() => {
    if (initial?.config.kind === 'flatten') {
      const v = initial.config.flatten.maxFileSizeBytes;
      return v ? String(Math.round(v / 1024 / 1024)) : '';
    }
    return '';
  });
  const [cleanupEmpty, setCleanupEmpty] = useState(
    initial?.config.kind === 'flatten' ? initial.config.flatten.cleanupEmpty : true,
  );

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setTagsInput((initial?.tags ?? []).join(', '));
      if (initial?.config.kind === 'flatten') {
        setStrategy(initial.config.flatten.conflictStrategy);
        const v = initial.config.flatten.maxFileSizeBytes;
        setMaxSizeMB(v ? String(Math.round(v / 1024 / 1024)) : '');
        setCleanupEmpty(initial.config.flatten.cleanupEmpty);
      } else {
        setStrategy(DEFAULT_FLATTEN_CONFIG.conflictStrategy);
        setMaxSizeMB('');
        setCleanupEmpty(true);
      }
    }
  }, [open, initial]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const tags = tagsInput
      .split(/[,\n]/)
      .map(t => t.trim())
      .filter(Boolean);
    const preset: Preset = {
      id: initial?.id ?? makeId(),
      name: trimmedName,
      description: description.trim() || undefined,
      tags,
      createdAt: initial?.createdAt ?? 0,
      updatedAt: Date.now(),
      config: {
        kind: 'flatten',
        flatten: {
          conflictStrategy: strategy,
          cleanupEmpty,
          maxFileSizeBytes:
            maxSizeMB.trim() === '' ? null : Math.max(0, Number(maxSizeMB)) * 1024 * 1024,
        },
      },
    };
    await upsert(preset);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? t('presetEditor.titleEdit') : t('presetEditor.titleNew')}
          </DialogTitle>
          <DialogDescription>{t('presetEditor.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">{t('presetEditor.name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('presetEditor.desc')}</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('presetEditor.tags')}</label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>
          <div>
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
          <div>
            <label className="text-xs text-muted-foreground">{t('presetEditor.maxSize')}</label>
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
        </div>
        <DialogFooter>
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
