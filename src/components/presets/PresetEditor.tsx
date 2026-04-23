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

interface Props {
  open: boolean;
  initial?: Preset;
  onClose: () => void;
}

const STRATEGY_LABELS: Record<ConflictStrategy, string> = {
  'parent-prefix-then-counter': 'Префикс родителя, затем счётчик',
  'counter-only': 'Только счётчик',
  skip: 'Пропускать',
  overwrite: 'Заменять',
  ask: 'Спрашивать',
};

function makeId(): string {
  return 'preset_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function PresetEditor({ open, initial, onClose }: Props) {
  const upsert = usePresetStore(s => s.upsert);

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
          <DialogTitle>{initial ? 'Редактировать пресет' : 'Новый пресет'}</DialogTitle>
          <DialogDescription>
            Настройте стратегию сведения, лимит размеров и теги для быстрой фильтрации
            в библиотеке.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Имя</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Описание</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Теги (через запятую)</label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>
          <div>
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
          <div>
            <label className="text-xs text-muted-foreground">
              Пропускать файлы больше (МБ)
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
            Удалять пустые папки после сведения
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
