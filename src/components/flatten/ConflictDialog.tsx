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
import { ScrollArea } from '@/components/ui/scroll-area';
import { MonoText } from '@/components/common/MonoText';
import type { ConflictResolution, NodeId, PendingConflict } from '@/types';

interface Props {
  open: boolean;
  conflicts: PendingConflict[];
  onResolve: (resolutions: Map<NodeId, ConflictResolution>) => void;
  onCancel: () => void;
}

type Choice = ConflictResolution['kind'];

const CHOICE_LABELS: Record<Choice, string> = {
  'keep-both': 'Оставить оба',
  newer: 'Взять более новый',
  replace: 'Заменить',
  skip: 'Пропустить',
};

const CHOICE_DESC: Record<Choice, string> = {
  'keep-both': 'К имени добавится префикс папки или счётчик',
  newer: 'По дате изменения; старый файл перейдёт в корзину',
  replace: 'Существующий файл перейдёт в корзину',
  skip: 'Файл останется на месте',
};

export function ConflictDialog({ open, conflicts, onResolve, onCancel }: Props) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [bulk, setBulk] = useState<Choice>('keep-both');

  useEffect(() => {
    if (open) {
      const initial: Record<string, Choice> = {};
      for (const c of conflicts) initial[c.fileNodeId] = 'keep-both';
      setChoices(initial);
    }
  }, [open, conflicts]);

  const applyBulk = (ch: Choice) => {
    setBulk(ch);
    const next: Record<string, Choice> = {};
    for (const c of conflicts) next[c.fileNodeId] = ch;
    setChoices(next);
  };

  const handleApply = () => {
    const map = new Map<NodeId, ConflictResolution>();
    for (const c of conflicts) {
      const ch = choices[c.fileNodeId] ?? 'keep-both';
      map.set(c.fileNodeId, { kind: ch } as ConflictResolution);
    }
    onResolve(map);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Конфликты имён при сведении</DialogTitle>
          <DialogDescription>
            Найдено совпадений: {conflicts.length}. Выберите, что сделать с каждым
            файлом, или примените выбор ко всем.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          <span className="text-xs text-muted-foreground self-center">Для всех:</span>
          {(Object.keys(CHOICE_LABELS) as Choice[]).map(ch => (
            <Button
              key={ch}
              variant={bulk === ch ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyBulk(ch)}
            >
              {CHOICE_LABELS[ch]}
            </Button>
          ))}
        </div>
        <ScrollArea className="max-h-[360px] rounded-md border border-border scrollbar-thin">
          <ul className="divide-y divide-border">
            {conflicts.map(c => (
              <li key={c.fileNodeId} className="p-2 space-y-1">
                <MonoText className="text-xs break-all">
                  {c.fileName} <span className="text-muted-foreground">(из {c.parentName})</span>
                </MonoText>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(CHOICE_LABELS) as Choice[]).map(ch => (
                    <Button
                      key={ch}
                      variant={choices[c.fileNodeId] === ch ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setChoices(prev => ({ ...prev, [c.fileNodeId]: ch }))
                      }
                      title={CHOICE_DESC[ch]}
                    >
                      {CHOICE_LABELS[ch]}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleApply}>Применить выбор</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
