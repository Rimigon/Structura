import { useMemo } from 'react';
import { FileSearch, Filter, Highlighter, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { findMatchingIds } from '@/core/search/filterTree';
import { useSelectionStore, useTreeStore } from '@/stores';
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
}

export function SearchBar({
  value,
  onChange,
  filterMode,
  onFilterModeChange,
  contentSearch,
  onContentSearchChange,
  contentScanning,
  contentMatchCount,
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
