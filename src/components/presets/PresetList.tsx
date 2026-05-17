import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileSearch,
  FileText,
  Layers,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { Preset, PresetKind } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassPanel } from '@/components/common/GlassPanel';
import { useSelectionStore, usePresetStore, useTreeStore, useUIStore } from '@/stores';
import { applyPreset } from '@/core/preset';
import {
  isTauri,
  pickOpenFile,
  pickSaveFile,
  readTextFile,
  writeTextFile,
} from '@/lib/tauri';
import { useT } from '@/lib/i18n';
import { PresetEditor } from './PresetEditor';

const KIND_ORDER: PresetKind[] = ['flatten', 'rename', 'dedup'];

const KIND_ICON: Record<PresetKind, typeof Layers> = {
  flatten: Layers,
  rename: Wand2,
  dedup: FileSearch,
};

export function PresetList() {
  const presets = usePresetStore(s => s.presets);
  const upsert = usePresetStore(s => s.upsert);
  const setImportOpen = useUIStore(s => s.setImportDialogOpen);
  const setExportOpen = useUIStore(s => s.setExportDialogOpen);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<PresetKind | 'all'>('all');
  const [collapsedKinds, setCollapsedKinds] = useState<Record<PresetKind, boolean>>(
    { flatten: false, rename: false, dedup: false },
  );
  const [editing, setEditing] = useState<Preset | null>(null);
  const [creating, setCreating] = useState(false);
  const t = useT();

  const handleExportPresets = async () => {
    if (!isTauri()) return;
    const path = await pickSaveFile(
      'structura-presets.json',
      'Structura presets',
      ['json'],
    ).catch(() => null);
    if (!path) return;
    const payload = JSON.stringify(
      { version: 1, presets, exportedAt: Date.now() },
      null,
      2,
    );
    try {
      await writeTextFile(path, payload);
    } catch (e) {
      console.error('export presets failed', e);
    }
  };

  const handleImportPresets = async () => {
    if (!isTauri()) return;
    const path = await pickOpenFile('Structura presets', ['json']).catch(() => null);
    if (!path) return;
    try {
      const content = await readTextFile(path);
      const data = JSON.parse(content) as { version: number; presets: Preset[] };
      if (!data || typeof data !== 'object' || !Array.isArray(data.presets)) {
        throw new Error('invalid preset file');
      }
      for (const p of data.presets) {
        await upsert({ ...p, updatedAt: Date.now() });
      }
    } catch (e) {
      console.error('import presets failed', e);
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of presets) for (const t of p.tags) tags.add(t);
    return Array.from(tags).sort();
  }, [presets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter(p => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (activeKind !== 'all' && p.config.kind !== activeKind) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [presets, search, activeTag, activeKind]);

  const grouped = useMemo(() => {
    const groups: { kind: PresetKind; items: Preset[] }[] = [];
    for (const kind of KIND_ORDER) {
      const items = filtered.filter(p => p.config.kind === kind);
      if (items.length > 0) groups.push({ kind, items });
    }
    return groups;
  }, [filtered]);

  const handleDuplicate = async (p: Preset) => {
    const copy: Preset = {
      ...p,
      id: 'preset_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      name: `${p.name} (${t('presets.copySuffix')})`,
      createdAt: 0,
      updatedAt: Date.now(),
    };
    await upsert(copy);
  };

  return (
    <GlassPanel className="border-r border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {t('presets.library')}
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
          {t('presets.importText')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4" />
          {t('presets.exportText')}
        </Button>
      </div>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('presets.header')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={t('presets.exportAll')}
            title={t('presets.exportAll')}
            onClick={handleExportPresets}
          >
            <Package className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={t('presets.importAll')}
            title={t('presets.importAll')}
            onClick={handleImportPresets}
          >
            <PackageOpen className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={t('presets.newOne')}
            title={t('presets.newOne')}
            onClick={() => setCreating(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-2 pb-1">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('presets.searchPlaceholder')}
          className="h-7 text-xs font-mono-tight"
        />
      </div>
      <div className="flex flex-wrap gap-1 px-2 pb-1">
        <KindChip
          kind="all"
          active={activeKind === 'all'}
          label={t('presets.kindAll')}
          onClick={() => setActiveKind('all')}
        />
        {KIND_ORDER.map(k => (
          <KindChip
            key={k}
            kind={k}
            active={activeKind === k}
            label={t(`presets.kind.${k}`)}
            onClick={() => setActiveKind(activeKind === k ? 'all' : k)}
          />
        ))}
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
            {t('presets.allTags')}
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={
                'text-[11px] rounded-full px-2 py-0.5 border transition-colors ' +
                (activeTag === tag
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/60')
              }
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="flex flex-col gap-1 px-2 pb-2">
          {grouped.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              {t('presets.noneFound')}
            </div>
          )}
          {grouped.map(group => {
            const collapsed = collapsedKinds[group.kind] ?? false;
            const Icon = KIND_ICON[group.kind];
            return (
              <section key={group.kind} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedKinds(prev => ({
                      ...prev,
                      [group.kind]: !collapsed,
                    }))
                  }
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  {collapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <Icon className="h-3 w-3" />
                  <span>{t(`presets.kind.${group.kind}`)}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {group.items.length}
                  </span>
                </button>
                {!collapsed && (
                  <div className="flex flex-col gap-1">
                    {group.items.map(p => (
                      <PresetItem
                        key={p.id}
                        preset={p}
                        onEdit={() => setEditing(p)}
                        onDuplicate={() => handleDuplicate(p)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
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

function PresetItem({
  preset,
  onEdit,
  onDuplicate,
}: {
  preset: Preset;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const focusedId = useSelectionStore(s => s.focusedId);
  const rootId = useTreeStore(s => s.rootId);
  const applyOps = useTreeStore(s => s.applyOps);
  const removePreset = usePresetStore(s => s.remove);
  const setDedupOpen = useUIStore(s => s.setDedupDialogOpen);
  const t = useT();

  const handleApply = () => {
    const tree = useTreeStore.getState();
    const target = focusedId ?? rootId;
    if (!target) return;
    if (preset.config.kind === 'dedup') {
      // Dedup needs disk hashes — delegate to DedupDialog (it reads the same
      // preset config internally when opened with kind='dedup').
      setDedupOpen(true);
      return;
    }
    const ops = applyPreset(tree, preset, target);
    if (ops.length > 0) applyOps(ops);
  };

  const Icon = KIND_ICON[preset.config.kind] ?? FileText;

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
              {preset.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[10px] rounded-full border border-border px-1.5 py-0 text-muted-foreground"
                >
                  #{tag}
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
          aria-label={t('presets.edit')}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={t('presets.duplicate')}
          onClick={onDuplicate}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={t('presets.delete')}
          onClick={() => removePreset(preset.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function KindChip({
  kind,
  active,
  label,
  onClick,
}: {
  kind: PresetKind | 'all';
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = kind === 'all' ? Layers : KIND_ICON[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background border-border text-muted-foreground hover:border-primary/60')
      }
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </button>
  );
}
