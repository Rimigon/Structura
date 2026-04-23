import { useMemo, useState } from 'react';
import { Layers, FileText, Upload, Download, Pencil, Trash2, Plus } from 'lucide-react';
import type { Preset } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassPanel } from '@/components/common/GlassPanel';
import { useSelectionStore, usePresetStore, useTreeStore, useUIStore } from '@/stores';
import { flatten } from '@/core/flatten/flatten';
import { DEFAULT_FLATTEN_CONFIG } from '@/types';
import { PresetEditor } from './PresetEditor';

export function PresetList() {
  const presets = usePresetStore(s => s.presets);
  const setImportOpen = useUIStore(s => s.setImportDialogOpen);
  const setExportOpen = useUIStore(s => s.setExportDialogOpen);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [creating, setCreating] = useState(false);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of presets) for (const t of p.tags) tags.add(t);
    return Array.from(tags).sort();
  }, [presets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter(p => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [presets, search, activeTag]);

  return (
    <GlassPanel className="border-r border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Библиотека
        </span>
      </div>
      <div className="flex flex-col gap-1 px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Импорт из текста
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4" />
          Экспорт в текст
        </Button>
      </div>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Пресеты</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Новый пресет"
          title="Новый пресет"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="px-2 pb-1">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени/тегу"
          className="h-7 text-xs font-mono-tight"
        />
      </div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={
              'text-[11px] rounded-full px-2 py-0.5 border transition-colors ' +
              (activeTag === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:border-primary/60')
            }
          >
            все
          </button>
          {allTags.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={
                'text-[11px] rounded-full px-2 py-0.5 border transition-colors ' +
                (activeTag === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/60')
              }
            >
              #{t}
            </button>
          ))}
        </div>
      )}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="flex flex-col gap-1 px-2 pb-2">
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              Ничего не найдено
            </div>
          )}
          {filtered.map(p => (
            <PresetItem key={p.id} preset={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      </ScrollArea>
      <PresetEditor
        open={!!editing || creating}
        initial={editing ?? undefined}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </GlassPanel>
  );
}

function PresetItem({ preset, onEdit }: { preset: Preset; onEdit: () => void }) {
  const focusedId = useSelectionStore(s => s.focusedId);
  const rootId = useTreeStore(s => s.rootId);
  const applyOps = useTreeStore(s => s.applyOps);
  const removePreset = usePresetStore(s => s.remove);

  const handleApply = () => {
    const tree = useTreeStore.getState();
    const target = focusedId ?? rootId;
    if (!target) return;
    if (preset.config.kind === 'flatten') {
      const { tx } = flatten(tree, target, preset.config.flatten ?? DEFAULT_FLATTEN_CONFIG);
      applyOps(tx.ops);
    }
  };

  const Icon = preset.config.kind === 'flatten' ? Layers : FileText;

  return (
    <div className="neumorphic group flex w-full items-start gap-2 rounded-md px-2 py-2">
      <button
        type="button"
        onClick={handleApply}
        className="flex flex-1 min-w-0 items-start gap-2 text-left"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{preset.name}</div>
          {preset.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {preset.description}
            </div>
          )}
          {preset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {preset.tags.map(t => (
                <span
                  key={t}
                  className="text-[10px] rounded-full border border-border px-1.5 py-0 text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Редактировать"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Удалить"
          onClick={() => removePreset(preset.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
