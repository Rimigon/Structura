import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FolderPlus,
  Plus,
  Radio,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MonoText } from '@/components/common/MonoText';
import { pickDirectory } from '@/lib/tauri';
import { usePresetStore, useUIStore, useWatcherStore } from '@/stores';
import type { RuleAction, WatcherRule } from '@/stores/watcherStore';

function WatcherCard({
  watchId,
  path,
  recursive,
  eventCount,
  onRemove,
}: {
  watchId: string;
  path: string;
  recursive: boolean;
  eventCount: number;
  onRemove: () => void;
}) {
  const rules = useWatcherStore(s => s.rules[watchId] ?? []);
  const addRule = useWatcherStore(s => s.addRule);
  const removeRule = useWatcherStore(s => s.removeRule);
  const updateRule = useWatcherStore(s => s.updateRule);
  const presets = usePresetStore(s => s.presets);
  const [showRules, setShowRules] = useState(false);
  const [newGlob, setNewGlob] = useState('');
  const [newAction, setNewAction] = useState<RuleAction>('notify');
  const [newPresetId, setNewPresetId] = useState<string>(presets[0]?.id ?? '');

  const handleAdd = () => {
    const g = newGlob.trim();
    if (!g) return;
    addRule(watchId, {
      glob: g,
      action: newAction,
      presetId: newAction === 'apply' ? newPresetId || null : null,
    });
    setNewGlob('');
  };

  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex items-center gap-2 text-xs font-mono-tight">
        <Radio className="h-3.5 w-3.5 text-diff-added shrink-0 animate-pulse" />
        <MonoText className="flex-1 truncate" title={path}>
          {path}
        </MonoText>
        <span className="text-muted-foreground shrink-0">
          {recursive ? 'рекурсивно' : 'без вложенных'}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          · событий: {eventCount}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowRules(v => !v)}
          aria-label="Правила"
          title="Правила совпадений"
        >
          <Zap className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
          aria-label="Остановить"
          title="Остановить наблюдатель"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {showRules && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {rules.length > 0 && (
            <ul className="space-y-1">
              {rules.map(r => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  presets={presets}
                  onUpdate={next => updateRule(watchId, next)}
                  onDelete={() => removeRule(watchId, r.id)}
                />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <Input
              value={newGlob}
              onChange={e => setNewGlob(e.target.value)}
              placeholder="маска (*.jpg)"
              className="h-7 text-[11px] font-mono-tight flex-1 min-w-[100px]"
            />
            <select
              value={newAction}
              onChange={e => setNewAction(e.target.value as RuleAction)}
              className="h-7 rounded-md border border-input bg-background px-1 text-[11px] font-mono-tight"
            >
              <option value="notify">только отметить</option>
              <option value="apply">применить пресет</option>
            </select>
            {newAction === 'apply' && (
              <select
                value={newPresetId}
                onChange={e => setNewPresetId(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-1 text-[11px] font-mono-tight max-w-[180px]"
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleAdd}
              aria-label="Добавить правило"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Правило срабатывает на событиях «создание». Маска матчится по имени
            файла: <code>*</code>, <code>?</code>, <code>[abc]</code>.
          </p>
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  presets,
  onUpdate,
  onDelete,
}: {
  rule: WatcherRule;
  presets: { id: string; name: string }[];
  onUpdate: (r: WatcherRule) => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-1 text-[11px] font-mono-tight">
      <MonoText className="shrink-0 rounded bg-muted px-1.5">
        {rule.glob}
      </MonoText>
      <span className="text-muted-foreground">→</span>
      <select
        value={rule.action}
        onChange={e =>
          onUpdate({ ...rule, action: e.target.value as RuleAction })
        }
        className="h-6 rounded border border-input bg-background px-1 text-[11px] font-mono-tight"
      >
        <option value="notify">отметить</option>
        <option value="apply">применить</option>
      </select>
      {rule.action === 'apply' && (
        <select
          value={rule.presetId ?? ''}
          onChange={e => onUpdate({ ...rule, presetId: e.target.value || null })}
          className="h-6 rounded border border-input bg-background px-1 text-[11px] font-mono-tight flex-1 max-w-[200px]"
        >
          <option value="">— выберите пресет —</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 ml-auto"
        onClick={onDelete}
        aria-label="Удалить правило"
      >
        <X className="h-3 w-3" />
      </Button>
    </li>
  );
}

const KIND_COLORS: Record<string, string> = {
  create: 'text-diff-added',
  modify: 'text-diff-renamed',
  remove: 'text-diff-removed',
  access: 'text-muted-foreground',
  other: 'text-muted-foreground',
  any: 'text-muted-foreground',
};

export function WatchersDialog() {
  const open = useUIStore(s => s.watchersDialogOpen);
  const setOpen = useUIStore(s => s.setWatchersDialogOpen);
  const watches = useWatcherStore(s => s.watches);
  const events = useWatcherStore(s => s.events);
  const subscribe = useWatcherStore(s => s.subscribe);
  const unsubscribe = useWatcherStore(s => s.unsubscribe);
  const clearEvents = useWatcherStore(s => s.clearEvents);
  const load = useWatcherStore(s => s.load);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdd = async () => {
    const path = await pickDirectory().catch(() => null);
    if (!path) return;
    setBusy(true);
    try {
      await subscribe(path, true);
    } finally {
      setBusy(false);
    }
  };

  const eventsByWatch = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.watchId, (m.get(e.watchId) ?? 0) + 1);
    return m;
  }, [events]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Наблюдатели папок
          </DialogTitle>
          <DialogDescription>
            Структура отслеживает изменения в выбранных папках и пишет события в
            журнал ниже. Наблюдение живёт до закрытия приложения.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Button onClick={handleAdd} size="sm" disabled={busy}>
            <FolderPlus className="h-4 w-4" />
            Добавить папку
          </Button>
          <span className="text-xs text-muted-foreground">
            Активно: {watches.length}
          </span>
        </div>

        {watches.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Нет активных наблюдателей.
          </div>
        ) : (
          <div className="space-y-2 border-b border-border pb-2 max-h-[240px] overflow-y-auto scrollbar-thin">
            {watches.map(w => (
              <WatcherCard
                key={w.id}
                watchId={w.id}
                path={w.path}
                recursive={w.recursive}
                eventCount={eventsByWatch.get(w.id) ?? 0}
                onRemove={() => unsubscribe(w.id)}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Журнал событий ({events.length})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearEvents}
            disabled={events.length === 0}
          >
            <X className="h-3.5 w-3.5" />
            Очистить
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            События появятся здесь, когда файлы изменятся.
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] rounded-md border border-border scrollbar-thin">
            <ul className="divide-y divide-border">
              {events.map((e, i) => (
                <li
                  key={e.timestamp + '-' + i}
                  className="p-2 text-[11px] font-mono-tight space-y-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        'uppercase tracking-wide ' + (KIND_COLORS[e.kind] ?? '')
                      }
                    >
                      {e.kind}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString('ru-RU')}
                    </span>
                    {e.matchedRuleIds && e.matchedRuleIds.length > 0 && (
                      <span className="flex items-center gap-1 text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        правило
                      </span>
                    )}
                    {e.appliedPresetNames && e.appliedPresetNames.length > 0 && (
                      <span className="flex items-center gap-1 text-diff-added">
                        <Zap className="h-3 w-3" />
                        {e.appliedPresetNames.join(', ')}
                      </span>
                    )}
                  </div>
                  {e.paths.map((p, pi) => (
                    <MonoText key={pi} className="text-xs truncate" title={p}>
                      {p}
                    </MonoText>
                  ))}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
