import { memo, useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, File as FileIcon, Folder, GripVertical } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { DirNode, NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { cn } from '@/lib/cn';
import { MonoText } from '@/components/common/MonoText';
import { Input } from '@/components/ui/input';
import { useSelectionStore, useTreeStore } from '@/stores';
import { useT } from '@/lib/i18n';
import { countDirectChildren } from '@/core/tree/traverse';
import { DiffBadge } from './DiffBadge';
import { FileThumbnail } from './FileThumbnail';

interface Props {
  node: TreeNode;
  depth: number;
  selected: boolean;
  inMultiSelect: boolean;
  editing: boolean;
  highlight: boolean;
  onToggle: (id: NodeId) => void;
  onSelect: (id: NodeId, mods: SelectMods) => void;
  onOpen: (id: NodeId) => void;
  onStartEdit: (id: NodeId) => void;
  onCommitEdit: (id: NodeId, newName: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (id: NodeId, x: number, y: number) => void;
}

const DIFF_CLASS: Record<NonNullable<TreeNode['dirty']>, string> = {
  new: 'border-l-2 border-diff-added',
  moved: 'border-l-2 border-diff-moved',
  renamed: 'border-l-2 border-diff-renamed',
  deleted: 'border-l-2 border-diff-removed line-through opacity-60',
};

function TreeRowInner({
  node,
  depth,
  selected,
  inMultiSelect,
  editing,
  highlight,
  onToggle,
  onSelect,
  onOpen,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onContextMenu,
}: Props) {
  const isDir = node.kind === 'dir';
  const expanded = isDir ? (node as DirNode).expanded : false;
  const diffClass = node.dirty ? DIFF_CLASS[node.dirty] : '';
  const t = useT();

  const counts = useTreeStore(
    useShallow(s => (isDir ? countDirectChildren(s, node.id) : null)),
  );

  const [draft, setDraft] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const draggable = useDraggable({ id: node.id, disabled: editing });
  const droppable = useDroppable({ id: 'drop-' + node.id, disabled: editing });
  const isDragOver = droppable.isOver;

  useEffect(() => {
    if (editing) {
      setDraft(node.name);
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [editing, node.name]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== node.name) onCommitEdit(node.id, trimmed);
    else onCancelEdit();
  };

  const setRefs = (el: HTMLDivElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  };

  return (
    <div
      ref={setRefs}
      role="treeitem"
      aria-expanded={isDir ? expanded : undefined}
      aria-selected={selected || inMultiSelect}
      tabIndex={selected ? 0 : -1}
      {...(editing ? {} : draggable.attributes)}
      {...(editing ? {} : draggable.listeners)}
      onClick={e => onSelect(node.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        // Preserve the multi-selection if the right-clicked row is part of it,
        // so mass-actions ("rename selection", "copy names") remain available.
        const ms = useSelectionStore.getState().multiSelect;
        if (!(ms.size > 1 && ms.has(node.id))) {
          onSelect(node.id, { ctrl: false, shift: false });
        } else {
          // Update focus/anchor without wiping the set.
          useSelectionStore.getState().focus(node.id);
        }
        onContextMenu(node.id, e.clientX, e.clientY);
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (isDir) onOpen(node.id);
        else onStartEdit(node.id);
      }}
      onKeyDown={e => {
        if (editing) return;
        if (isDir && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle(node.id);
        }
      }}
      title={isDir ? t('tree.rowTipDir') : t('tree.rowTipFile')}
      className={cn(
        'group flex items-center gap-1 px-2 py-0.5 cursor-grab active:cursor-grabbing select-none rounded-sm',
        'hover:bg-accent/60',
        selected && 'bg-primary/25 ring-1 ring-primary/70',
        inMultiSelect && !selected && 'bg-primary/15 ring-1 ring-primary/40',
        highlight && !selected && !inMultiSelect && 'bg-accent/40 ring-1 ring-primary/50',
        isDragOver && isDir && 'drop-target-pulse bg-diff-moved/15',
        draggable.isDragging && 'drag-source',
        node.dirty === 'new' && 'row-appear',
        node.dirty === 'deleted' && 'row-deleting',
        diffClass,
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <span
        className="h-4 w-4 items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground flex pointer-events-none"
        aria-hidden="true"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      {isDir ? (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={expanded ? t('tree.collapse') : t('tree.expand')}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <span className="h-4 w-4" />
      )}
      {isDir ? (
        <Folder className="h-3.5 w-3.5 text-primary" />
      ) : (
        <FileThumbnail
          node={node}
          size={48}
          className="h-4 w-4 shrink-0 rounded-[2px] object-cover"
          fallback={<FileIcon className="h-3.5 w-3.5 text-muted-foreground" />}
        />
      )}
      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onClick={e => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          className="h-5 px-1 py-0 text-xs font-mono-tight flex-1"
          spellCheck={false}
        />
      ) : (
        <MonoText className="flex-1 truncate">
          {node.name}
          {isDir ? '/' : ''}
        </MonoText>
      )}
      {isDir && !editing && counts && (counts.files > 0 || counts.dirs > 0) && (
        <span
          className="text-muted-foreground/60 text-[10px] tabular-nums flex items-center gap-1 mr-1"
          title={t('tree.countTooltip', { files: counts.files, dirs: counts.dirs })}
          aria-hidden="true"
        >
          <FileIcon className="h-3 w-3" />
          {counts.files}
          <Folder className="h-3 w-3" />
          {counts.dirs}
        </span>
      )}
      <DiffBadge dirty={node.dirty} />
    </div>
  );
}

export const TreeRow = memo(TreeRowInner);
