import { useMemo } from 'react';
import { Filter, Highlighter, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { findMatchingIds } from '@/core/search/filterTree';
import { useSelectionStore, useTreeStore } from '@/stores';

interface Props {
  value: string;
  onChange: (next: string) => void;
  filterMode: boolean;
  onFilterModeChange: (next: boolean) => void;
}

export function SearchBar({ value, onChange, filterMode, onFilterModeChange }: Props) {
  const nodes = useTreeStore(s => s.nodes);
  const rootId = useTreeStore(s => s.rootId);
  const rootFsPath = useTreeStore(s => s.rootFsPath);

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
        placeholder="Поиск (* ? [abc])"
        className="h-7 text-xs font-mono-tight"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={filterMode ? 'Режим: скрывать несовпавшие' : 'Режим: подсвечивать'}
        title={filterMode ? 'Скрывать несовпавшие' : 'Только подсветка'}
        onClick={() => onFilterModeChange(!filterMode)}
      >
        {filterMode ? (
          <Filter className="h-3.5 w-3.5 text-primary" />
        ) : (
          <Highlighter className="h-3.5 w-3.5" />
        )}
      </Button>
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
            Выделить всё
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange('')}
            aria-label="Очистить"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
