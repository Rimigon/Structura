import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useSelectionStore, useTreeStore } from '@/stores';
import { findMatchingIds } from '@/core/search/filterTree';
import { TreeRow } from './TreeRow';
import { SearchBar } from './SearchBar';
import { TreeContextMenu, type ContextMenuState } from './TreeContextMenu';
import { FolderOpen, Loader2 } from 'lucide-react';

interface FlatRow {
  node: TreeNode;
  depth: number;
}

function flatten(
  nodes: Record<NodeId, TreeNode>,
  id: NodeId,
  depth: number,
  out: FlatRow[],
): void {
  const node = nodes[id];
  if (!node) return;
  out.push({ node, depth });
  if (node.kind === 'dir' && (node as DirNode).expanded) {
    for (const cid of (node as DirNode).childIds) {
      flatten(nodes, cid, depth + 1, out);
    }
  }
}

function flattenFiltered(
  nodes: Record<NodeId, TreeNode>,
  id: NodeId,
  depth: number,
  visible: Set<NodeId>,
  out: FlatRow[],
): void {
  const node = nodes[id];
  if (!node || !visible.has(id)) return;
  out.push({ node, depth });
  if (node.kind === 'dir') {
    for (const cid of (node as DirNode).childIds) {
      flattenFiltered(nodes, cid, depth + 1, visible, out);
    }
  }
}

export function TreeCanvas() {
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const loading = useTreeStore(s => s.loading);
  const focusedId = useSelectionStore(s => s.focusedId);
  const editingId = useSelectionStore(s => s.editingId);
  const multiSelect = useSelectionStore(s => s.multiSelect);

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const matchSet = useMemo(() => {
    if (!query.trim() || !rootId) return new Set<NodeId>();
    return new Set(findMatchingIds({ nodes, rootId, rootFsPath }, { pattern: query }));
  }, [query, nodes, rootId, rootFsPath]);

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

  const flat = useMemo(() => {
    if (!rootId) return [];
    const out: FlatRow[] = [];
    if (visibleSet) flattenFiltered(nodes, rootId, 0, visibleSet, out);
    else flatten(nodes, rootId, 0, out);
    return out;
  }, [nodes, rootId, visibleSet]);

  const orderedIdsRef = useRef<NodeId[]>([]);
  orderedIdsRef.current = useMemo(() => flat.map(f => f.node.id), [flat]);

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

  if (!rootId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground font-mono-tight text-sm gap-2">
        <FolderOpen className="h-8 w-8" />
        <span>Откройте папку, чтобы начать работу</span>
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
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <ScrollArea className="flex-1 w-full scrollbar-thin">
          <div
            role="tree"
            aria-label="Дерево каталогов"
            className="py-2"
            onClick={handleBackgroundClick}
          >
            {flat.map(({ node, depth }) => (
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
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 text-xs font-mono-tight">
            <Loader2 className="h-4 w-4 animate-spin" />
            Сканирование…
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
