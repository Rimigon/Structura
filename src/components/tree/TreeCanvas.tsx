import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { DirNode, NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';
import { GRID_SIZE_STEP, type DetailsSort } from '@/stores/uiStore';
import { findMatchingIds } from '@/core/search/filterTree';
import { isTauri, searchContent } from '@/lib/tauri';
import { useT } from '@/lib/i18n';
import { TreeRow } from './TreeRow';
import { TreeGridItem } from './TreeGridItem';
import { TreeListItem } from './TreeListItem';
import { TreeTileItem } from './TreeTileItem';
import { GalleryView } from './GalleryView';
import { ColumnsView } from './ColumnsView';
import { TreeDetailsRow, DETAILS_COLS } from './TreeDetailsRow';
import { SearchBar } from './SearchBar';
import { TreeContextMenu, type ContextMenuState } from './TreeContextMenu';
import { ChevronDown, ChevronUp, FolderOpen, Loader2 } from 'lucide-react';

interface FlatRow {
  node: TreeNode;
  depth: number;
}

type NodeCmp = (a: TreeNode, b: TreeNode) => number;

function sortedChildIds(
  nodes: Record<NodeId, TreeNode>,
  childIds: NodeId[],
  cmp: NodeCmp | null,
): NodeId[] {
  if (!cmp) return childIds;
  return [...childIds].sort((x, y) => {
    const a = nodes[x];
    const b = nodes[y];
    if (!a || !b) return 0;
    return cmp(a, b);
  });
}

function flatten(
  nodes: Record<NodeId, TreeNode>,
  id: NodeId,
  depth: number,
  out: FlatRow[],
  cmp: NodeCmp | null,
): void {
  const node = nodes[id];
  if (!node) return;
  out.push({ node, depth });
  if (node.kind === 'dir' && (node as DirNode).expanded) {
    for (const cid of sortedChildIds(nodes, (node as DirNode).childIds, cmp)) {
      flatten(nodes, cid, depth + 1, out, cmp);
    }
  }
}

function flattenFiltered(
  nodes: Record<NodeId, TreeNode>,
  id: NodeId,
  depth: number,
  visible: Set<NodeId>,
  out: FlatRow[],
  cmp: NodeCmp | null,
): void {
  const node = nodes[id];
  if (!node || !visible.has(id)) return;
  out.push({ node, depth });
  if (node.kind === 'dir') {
    for (const cid of sortedChildIds(nodes, (node as DirNode).childIds, cmp)) {
      flattenFiltered(nodes, cid, depth + 1, visible, out, cmp);
    }
  }
}

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function buildComparator(sort: DetailsSort): NodeCmp {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return (a, b) => {
    // Folders always group before files, regardless of sort direction.
    const aDir = a.kind === 'dir';
    const bDir = b.kind === 'dir';
    if (aDir !== bDir) return aDir ? -1 : 1;
    let cmp = 0;
    switch (sort.key) {
      case 'type': {
        const ax = a.kind === 'file' ? a.ext : '';
        const bx = b.kind === 'file' ? b.ext : '';
        cmp = COLLATOR.compare(ax, bx);
        break;
      }
      case 'size': {
        const as = a.kind === 'file' ? a.size : 0;
        const bs = b.kind === 'file' ? b.size : 0;
        cmp = as - bs;
        break;
      }
      case 'modified': {
        const am = a.kind === 'file' ? a.modified : 0;
        const bm = b.kind === 'file' ? b.modified : 0;
        cmp = am - bm;
        break;
      }
      case 'name':
      default:
        cmp = 0;
    }
    if (cmp === 0) cmp = COLLATOR.compare(a.name, b.name);
    return cmp * sign;
  };
}

export function TreeCanvas() {
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const loading = useTreeStore(s => s.loading);
  const focusedId = useSelectionStore(s => s.focusedId);
  const editingId = useSelectionStore(s => s.editingId);
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const viewMode = useUIStore(s => s.treeViewMode);
  const setViewMode = useUIStore(s => s.setTreeViewMode);
  const gridSize = useUIStore(s => s.gridSize);
  const setGridSize = useUIStore(s => s.setGridSize);
  const detailsSort = useUIStore(s => s.detailsSort);
  const toggleDetailsSort = useUIStore(s => s.toggleDetailsSort);
  const t = useT();

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [contentSearch, setContentSearch] = useState(false);
  const [contentMatches, setContentMatches] = useState<Set<NodeId>>(() => new Set());
  const [contentScanning, setContentScanning] = useState(false);

  // Name-based match set (sync).
  const nameMatchSet = useMemo(() => {
    if (!query.trim() || !rootId) return new Set<NodeId>();
    return new Set(findMatchingIds({ nodes, rootId, rootFsPath }, { pattern: query }));
  }, [query, nodes, rootId, rootFsPath]);

  // Content-search effect (debounced). Runs only when enabled + Tauri + query >= 2 chars.
  useEffect(() => {
    if (!contentSearch || !isTauri() || !rootFsPath || query.trim().length < 2) {
      setContentMatches(new Set());
      setContentScanning(false);
      return;
    }
    let cancelled = false;
    setContentScanning(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchContent(rootFsPath, query.trim(), {
          maxResults: 5000,
        });
        if (cancelled) return;
        const hitPaths = new Set<string>();
        for (const m of res.matches) hitPaths.add(m.path);
        // Build a lookup: originalPath -> nodeId
        const pathToId = new Map<string, NodeId>();
        for (const n of Object.values(nodes)) {
          if (n.dirty === 'deleted') continue;
          if (n.kind !== 'file') continue;
          if (n.originalPath) pathToId.set(n.originalPath, n.id);
        }
        const ids = new Set<NodeId>();
        for (const p of hitPaths) {
          const id = pathToId.get(p);
          if (id) ids.add(id);
        }
        setContentMatches(ids);
      } catch {
        if (!cancelled) setContentMatches(new Set());
      } finally {
        if (!cancelled) setContentScanning(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      setContentScanning(false);
    };
  }, [contentSearch, rootFsPath, query, nodes]);

  // Union of name and content matches.
  const matchSet = useMemo(() => {
    if (nameMatchSet.size === 0 && contentMatches.size === 0) {
      return new Set<NodeId>();
    }
    const out = new Set<NodeId>(nameMatchSet);
    for (const id of contentMatches) out.add(id);
    return out;
  }, [nameMatchSet, contentMatches]);

  const highlightSet = useMemo(() => {
    if (filterMode || matchSet.size === 0) return matchSet;
    const out = new Set<NodeId>(matchSet);
    for (const id of matchSet) {
      let cur: NodeId | null = nodes[id]?.parentId ?? null;
      let sawCollapsed = false;
      while (cur) {
        const p = nodes[cur];
        if (!p || p.kind !== 'dir') break;
        if (!(p as DirNode).expanded) sawCollapsed = true;
        if (sawCollapsed) out.add(cur);
        cur = p.parentId;
      }
    }
    return out;
  }, [filterMode, matchSet, nodes]);

  const visibleSet = useMemo(() => {
    if (!filterMode || matchSet.size === 0) return null;
    const out = new Set<NodeId>();
    for (const id of matchSet) {
      let cur: NodeId | null = id;
      while (cur) {
        if (out.has(cur)) break;
        out.add(cur);
        cur = nodes[cur]?.parentId ?? null;
      }
    }
    return out;
  }, [filterMode, matchSet, nodes]);

  // The details view sorts siblings by the active column; every other mode keeps
  // the on-disk (childIds) order.
  const sortCmp = useMemo<NodeCmp | null>(
    () => (viewMode === 'details' ? buildComparator(detailsSort) : null),
    [viewMode, detailsSort],
  );

  const flat = useMemo(() => {
    if (!rootId) return [];
    const out: FlatRow[] = [];
    if (visibleSet) flattenFiltered(nodes, rootId, 0, visibleSet, out, sortCmp);
    else flatten(nodes, rootId, 0, out, sortCmp);
    return out;
  }, [nodes, rootId, visibleSet, sortCmp]);

  const orderedIdsRef = useRef<NodeId[]>([]);
  orderedIdsRef.current = useMemo(() => flat.map(f => f.node.id), [flat]);

  // Progressive rendering: mount the first screenful immediately, then grow the
  // rendered window a chunk per animation frame so opening a huge folder never
  // freezes. Off-screen images don't decode anyway (loading=lazy +
  // content-visibility), so this only bounds the React render cost.
  const INITIAL_BATCH = 200;
  const BATCH_STEP = 200;
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  // Reset to the first batch whenever the rendered set fundamentally changes.
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [rootId, viewMode, filterMode, query]);
  // Grow one chunk per frame until everything is mounted.
  useEffect(() => {
    if (visibleCount >= flat.length) return;
    const raf = requestAnimationFrame(() =>
      setVisibleCount(c => Math.min(flat.length, c + BATCH_STEP)),
    );
    return () => cancelAnimationFrame(raf);
  }, [visibleCount, flat.length]);

  const visibleFlat = useMemo(
    () => (visibleCount >= flat.length ? flat : flat.slice(0, visibleCount)),
    [flat, visibleCount],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleToggle = useCallback((id: NodeId) => {
    useTreeStore.getState().toggleExpanded(id);
  }, []);

  const handleSelect = useCallback((id: NodeId, mods: SelectMods) => {
    useSelectionStore.getState().select(id, mods, orderedIdsRef.current);
  }, []);

  const handleOpen = useCallback((id: NodeId) => {
    const tree = useTreeStore.getState();
    const n = tree.nodes[id];
    if (n && n.kind === 'dir' && n.originalPath && id !== tree.rootId) {
      tree.scanRoot(n.originalPath);
    }
  }, []);

  const handleStartEdit = useCallback((id: NodeId) => {
    useSelectionStore.getState().startEditing(id);
  }, []);

  const handleCommitEdit = useCallback((id: NodeId, newName: string) => {
    useTreeStore.getState().renameNode(id, newName);
    useSelectionStore.getState().startEditing(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    useSelectionStore.getState().startEditing(null);
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    if (!e.over) return;
    const sourceId = String(e.active.id);
    const overIdRaw = String(e.over.id);
    const rawTargetId = overIdRaw.startsWith('drop-') ? overIdRaw.slice(5) : overIdRaw;
    if (sourceId === rawTargetId) return;
    const tree = useTreeStore.getState();
    const rawTarget = tree.nodes[rawTargetId];
    if (!rawTarget) return;
    const targetDirId =
      rawTarget.kind === 'dir' ? rawTarget.id : rawTarget.parentId;
    if (!targetDirId || sourceId === targetDirId) return;
    const srcNode = tree.nodes[sourceId];
    if (srcNode?.parentId === targetDirId) return;
    tree.moveNode(sourceId, targetDirId, null);
  }, []);

  const handleBackgroundClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      useSelectionStore.getState().clear();
    }
  }, []);

  const handleContextMenu = useCallback((id: NodeId, x: number, y: number) => {
    setMenu({ nodeId: id, x, y });
  }, []);

  // Ctrl+wheel zoom for grid/details. A native non-passive listener is required
  // so preventDefault actually suppresses the webview's own page zoom.
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>();
  if (!wheelHandlerRef.current) {
    wheelHandlerRef.current = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const ui = useUIStore.getState();
      ui.setGridSize(ui.gridSize + (e.deltaY < 0 ? GRID_SIZE_STEP : -GRID_SIZE_STEP));
    };
  }
  const zoomElRef = useRef<HTMLDivElement | null>(null);
  const setZoomEl = useCallback((el: HTMLDivElement | null) => {
    if (zoomElRef.current) {
      zoomElRef.current.removeEventListener('wheel', wheelHandlerRef.current!);
    }
    zoomElRef.current = el;
    if (el) el.addEventListener('wheel', wheelHandlerRef.current!, { passive: false });
  }, []);

  // Derived preview sizes. Thumbnail request sizes are quantised to 64-px
  // buckets so a few zoom steps reuse the same cached decode.
  // Request sizes are kept small (close to display size) so the base64 payload
  // and decode stay light — the visible image is CSS-scaled anyway.
  const gridThumbReq = Math.min(224, Math.ceil((gridSize * 1.1) / 32) * 32);
  const detailThumb = Math.max(18, Math.min(80, Math.round(gridSize / 3)));
  const detailThumbReq = Math.min(128, Math.ceil((detailThumb * 1.4) / 32) * 32);
  const tileThumb = Math.max(36, Math.min(120, Math.round(gridSize * 0.46)));
  const tileThumbReq = Math.min(192, Math.ceil((tileThumb * 1.3) / 32) * 32);
  const stripThumb = Math.max(52, Math.min(160, Math.round(gridSize * 0.56)));

  if (!rootId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground font-mono-tight text-sm gap-2">
        <FolderOpen className="h-8 w-8" />
        <span>{t('tree.emptyState')}</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      <SearchBar
        value={query}
        onChange={setQuery}
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
        contentSearch={contentSearch}
        onContentSearchChange={setContentSearch}
        contentScanning={contentScanning}
        contentMatchCount={contentMatches.size}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
      />
      {viewMode === 'tree' && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <ScrollArea className="flex-1 w-full scrollbar-thin">
            <div
              role="tree"
              aria-label={t('tree.ariaLabel')}
              className="py-2"
              onClick={handleBackgroundClick}
            >
              {visibleFlat.map(({ node, depth }) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={depth}
                  selected={focusedId === node.id}
                  inMultiSelect={multiSelect.has(node.id)}
                  editing={editingId === node.id}
                  highlight={highlightSet.has(node.id)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onOpen={handleOpen}
                  onStartEdit={handleStartEdit}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={handleCancelEdit}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </ScrollArea>
        </DndContext>
      )}
      {viewMode === 'grid' && (
        <div ref={setZoomEl} className="flex-1 min-h-0 w-full overflow-auto scrollbar-thin">
          <div
            role="tree"
            aria-label={t('tree.ariaLabel')}
            className="grid gap-2 p-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
            }}
            onClick={handleBackgroundClick}
          >
            {visibleFlat.map(({ node }) => (
              <TreeGridItem
                key={node.id}
                node={node}
                size={gridSize}
                thumbSize={gridThumbReq}
                selected={focusedId === node.id}
                inMultiSelect={multiSelect.has(node.id)}
                editing={editingId === node.id}
                highlight={highlightSet.has(node.id)}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onStartEdit={handleStartEdit}
                onCommitEdit={handleCommitEdit}
                onCancelEdit={handleCancelEdit}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        </div>
      )}
      {viewMode === 'details' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            className={
              DETAILS_COLS +
              ' shrink-0 border-b border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-mono-tight'
            }
          >
            {(
              [
                ['name', 'details.colName'],
                ['type', 'details.colType'],
                ['size', 'details.colSize'],
                ['modified', 'details.colModified'],
              ] as [DetailsSort['key'], string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDetailsSort(key)}
                className={
                  'flex items-center gap-1 hover:text-foreground ' +
                  (key === 'size' ? 'justify-end' : '')
                }
              >
                <span>{t(label)}</span>
                {detailsSort.key === key &&
                  (detailsSort.dir === 'asc' ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  ))}
              </button>
            ))}
          </div>
          <div
            ref={setZoomEl}
            className="flex-1 min-h-0 w-full overflow-auto scrollbar-thin"
          >
            <div role="tree" aria-label={t('tree.ariaLabel')} onClick={handleBackgroundClick}>
              {visibleFlat.map(({ node, depth }, index) => (
                <TreeDetailsRow
                  key={node.id}
                  node={node}
                  depth={depth}
                  index={index}
                  thumbPx={detailThumb}
                  thumbSize={detailThumbReq}
                  selected={focusedId === node.id}
                  inMultiSelect={multiSelect.has(node.id)}
                  editing={editingId === node.id}
                  highlight={highlightSet.has(node.id)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onStartEdit={handleStartEdit}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={handleCancelEdit}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {viewMode === 'list' && (
        <div className="flex-1 min-h-0 w-full overflow-auto scrollbar-thin">
          <div
            role="tree"
            aria-label={t('tree.ariaLabel')}
            className="p-2"
            style={{ columnWidth: 220 }}
            onClick={handleBackgroundClick}
          >
            {visibleFlat.map(({ node }) => (
              <TreeListItem
                key={node.id}
                node={node}
                selected={focusedId === node.id}
                inMultiSelect={multiSelect.has(node.id)}
                editing={editingId === node.id}
                highlight={highlightSet.has(node.id)}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onStartEdit={handleStartEdit}
                onCommitEdit={handleCommitEdit}
                onCancelEdit={handleCancelEdit}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        </div>
      )}
      {viewMode === 'tiles' && (
        <div ref={setZoomEl} className="flex-1 min-h-0 w-full overflow-auto scrollbar-thin">
          <div
            role="tree"
            aria-label={t('tree.ariaLabel')}
            className="grid gap-2 p-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(180, tileThumb * 2.6)}px, 1fr))`,
            }}
            onClick={handleBackgroundClick}
          >
            {visibleFlat.map(({ node }) => (
              <TreeTileItem
                key={node.id}
                node={node}
                thumbPx={tileThumb}
                thumbSize={tileThumbReq}
                selected={focusedId === node.id}
                inMultiSelect={multiSelect.has(node.id)}
                editing={editingId === node.id}
                highlight={highlightSet.has(node.id)}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onStartEdit={handleStartEdit}
                onCommitEdit={handleCommitEdit}
                onCancelEdit={handleCancelEdit}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        </div>
      )}
      {viewMode === 'gallery' && (
        <div ref={setZoomEl} className="flex flex-1 min-h-0 flex-col">
          <GalleryView
            rows={visibleFlat.map(f => f.node)}
            focusedId={focusedId}
            multiSelect={multiSelect}
            stripThumb={stripThumb}
            onSelect={handleSelect}
            onToggle={handleToggle}
            onContextMenu={handleContextMenu}
          />
        </div>
      )}
      {viewMode === 'columns' && <ColumnsView onContextMenu={handleContextMenu} />}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 text-xs font-mono-tight">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('tree.scanning')}
          </div>
        </div>
      )}
      {menu && (
        <TreeContextMenu
          x={menu.x}
          y={menu.y}
          nodeId={menu.nodeId}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
