import { useMemo } from 'react';
import {
  Columns3,
  FileSearch,
  Filter,
  GalleryThumbnails,
  Highlighter,
  LayoutGrid,
  LayoutList,
  List,
  ListTree,
  Loader2,
  Search,
  Table2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { findMatchingIds } from '@/core/search/filterTree';
import { useSelectionStore, useTreeStore } from '@/stores';
import {
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  GRID_SIZE_STEP,
  ZOOMABLE_VIEW_MODES,
  type TreeViewMode,
} from '@/stores/uiStore';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

interface Props {
  value: string;
  onChange: (next: string) => void;
  filterMode: boolean;
  onFilterModeChange: (next: boolean) => void;
  contentSearch: boolean;
  onContentSearchChange: (next: boolean) => void;
  contentScanning: boolean;
  contentMatchCount: number;
  viewMode: TreeViewMode;
  onViewModeChange: (next: TreeViewMode) => void;
  gridSize: number;
  onGridSizeChange: (next: number) => void;
}

const VIEW_MODES: { id: TreeViewMode; icon: typeof ListTree; labelKey: string }[] = [
  { id: 'tree', icon: ListTree, labelKey: 'view.tree' },
  { id: 'list', icon: List, labelKey: 'view.list' },
  { id: 'tiles', icon: LayoutList, labelKey: 'view.tiles' },
  { id: 'grid', icon: LayoutGrid, labelKey: 'view.grid' },
  { id: 'gallery', icon: GalleryThumbnails, labelKey: 'view.gallery' },
  { id: 'details', icon: Table2, labelKey: 'view.details' },
  { id: 'columns', icon: Columns3, labelKey: 'view.columns' },
];

export function SearchBar({
  value,
  onChange,
  filterMode,
  onFilterModeChange,
  contentSearch,
  onContentSearchChange,
  contentScanning,
  contentMatchCount,
  viewMode,
  onViewModeChange,
  gridSize,
  onGridSizeChange,
}: Props) {
  const nodes = useTreeStore(s => s.nodes);
  const rootId = useTreeStore(s => s.rootId);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const t = useT();

  const matches = useMemo(() => {
    if (!value.trim() || !rootId) return [] as string[];
    return findMatchingIds({ nodes, rootId, rootFsPath }, { pattern: value });
  }, [value, nodes, rootId, rootFsPath]);

  const handleSelectAll = () => {
    if (matches.length === 0) return;
    useSelectionStore.setState(state => {
      const next = new Set(state.multiSelect);
      for (const id of matches) next.add(id);
      return {
        ...state,
        multiSelect: next,
        focusedId: matches[0] ?? state.focusedId,
        lastAnchorId: matches[0] ?? state.lastAnchorId,
      };
    });
  };

  return (
    <div className="flex items-center gap-2 border-b border-border px-2 py-1">
      <div className="flex items-center rounded-md border border-border p-0.5">
        {VIEW_MODES.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewModeChange(id)}
            aria-label={t(labelKey)}
            aria-pressed={viewMode === id}
            title={t(labelKey)}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded transition-colors',
              viewMode === id
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      {ZOOMABLE_VIEW_MODES.includes(viewMode) && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onGridSizeChange(gridSize - GRID_SIZE_STEP)}
            disabled={gridSize <= GRID_SIZE_MIN}
            aria-label={t('view.zoomOut')}
            title={t('view.zoomOut')}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <input
            type="range"
            min={GRID_SIZE_MIN}
            max={GRID_SIZE_MAX}
            step={GRID_SIZE_STEP}
            value={gridSize}
            onChange={e => onGridSizeChange(Number(e.target.value))}
            className="h-1 w-16 cursor-pointer accent-primary"
            aria-label={t('view.size')}
            title={`${t('view.size')}: ${gridSize}px`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onGridSizeChange(gridSize + GRID_SIZE_STEP)}
            disabled={gridSize >= GRID_SIZE_MAX}
            aria-label={t('view.zoomIn')}
            title={t('view.zoomIn')}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <Input
        data-tree-search
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('search.placeholder')}
        className="h-7 text-xs font-mono-tight"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={t('search.filterMode')}
        title={t('search.filterMode')}
        onClick={() => onFilterModeChange(!filterMode)}
      >
        {filterMode ? (
          <Filter className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Highlighter className="h-3.5 w-3.5" />
        )}
      </Button>
      <label
        className={
          'flex items-center gap-1 text-[11px] font-mono-tight rounded-md border px-1.5 py-0.5 cursor-pointer select-none transition-colors ' +
          (contentSearch
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border text-muted-foreground hover:border-primary/40')
        }
        title={t('search.inContent')}
      >
        <FileSearch className="h-3 w-3" />
        <input
          type="checkbox"
          className="sr-only"
          checked={contentSearch}
          onChange={e => onContentSearchChange(e.target.checked)}
        />
        <span className="hidden sm:inline">{t('search.inContent')}</span>
      </label>
      {contentScanning && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('search.scanning')}
        </span>
      )}
      {contentSearch && !contentScanning && value && (
        <span
          className="text-[11px] text-muted-foreground whitespace-nowrap"
          title={t('search.matchesInside')}
        >
          ⊂{contentMatchCount}
        </span>
      )}
      {value && (
        <>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {matches.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleSelectAll}
            disabled={matches.length === 0}
          >
            {t('common.selected')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange('')}
            aria-label={t('common.close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
