import { memo, useEffect, useRef, useState } from 'react';
import { File as FileIcon, Folder } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { useSelectionStore, useTreeStore } from '@/stores';
import { useT } from '@/lib/i18n';
import { countDirectChildren } from '@/core/tree/traverse';
import { DiffBadge } from './DiffBadge';
import { FileThumbnail } from './FileThumbnail';

interface Props {
  node: TreeNode;
  /** Card target width (px) — drives the preview tile + icon size. */
  size: number;
  /** Backend thumbnail request size (px). */
  thumbSize: number;
  selected: boolean;
  inMultiSelect: boolean;
  editing: boolean;
  highlight: boolean;
  onToggle: (id: NodeId) => void;
  onSelect: (id: NodeId, mods: SelectMods) => void;
  onStartEdit: (id: NodeId) => void;
  onCommitEdit: (id: NodeId, newName: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (id: NodeId, x: number, y: number) => void;
}

const DIFF_CLASS: Record<NonNullable<TreeNode['dirty']>, string> = {
  new: 'border-diff-added/70',
  moved: 'border-diff-moved/70',
  renamed: 'border-diff-renamed/70',
  deleted: 'border-diff-removed/70 line-through opacity-60',
};

function TreeGridItemInner({
  node,
  size,
  thumbSize,
  selected,
  inMultiSelect,
  editing,
  highlight,
  onToggle,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onContextMenu,
}: Props) {
  const isDir = node.kind === 'dir';
  const iconPx = Math.max(28, Math.min(120, Math.round(size * 0.46)));
  const diffClass = node.dirty ? DIFF_CLASS[node.dirty] : 'border-border/60';
  const t = useT();

  const counts = useTreeStore(
    useShallow(s => (isDir ? countDirectChildren(s, node.id) : null)),
  );

  const [draft, setDraft] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(node.name);
      const tm = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(tm);
    }
  }, [editing, node.name]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== node.name) onCommitEdit(node.id, trimmed);
    else onCancelEdit();
  };

  return (
    <div
      role="treeitem"
      aria-selected={selected || inMultiSelect}
      onClick={e =>
        onSelect(node.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
      }
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        const ms = useSelectionStore.getState().multiSelect;
        if (!(ms.size > 1 && ms.has(node.id))) {
          onSelect(node.id, { ctrl: false, shift: false });
        } else {
          useSelectionStore.getState().focus(node.id);
        }
        onContextMenu(node.id, e.clientX, e.clientY);
      }}
      onDoubleClick={e => {
        e.stopPropagation();
        if (isDir) onToggle(node.id);
        else onStartEdit(node.id);
      }}
      title={isDir ? t('tree.gridTipDir') : t('tree.rowTipFile')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${size + 48}px` }}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 rounded-md border p-2 text-center cursor-pointer select-none transition-colors',
        'hover:bg-accent/50',
        diffClass,
        selected && 'bg-primary/25 ring-1 ring-primary/70',
        inMultiSelect && !selected && 'bg-primary/15 ring-1 ring-primary/40',
        highlight && !selected && !inMultiSelect && 'bg-accent/40 ring-1 ring-primary/50',
        node.dirty === 'new' && 'row-appear',
      )}
    >
      <div className="absolute right-1 top-1">
        <DiffBadge dirty={node.dirty} />
      </div>
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-muted/30">
        {isDir ? (
          <Folder style={{ width: iconPx, height: iconPx }} className="text-primary" />
        ) : (
          <FileThumbnail
            node={node}
            size={thumbSize}
            className="max-h-full max-w-full rounded object-contain"
            fallback={
              <FileIcon
                style={{ width: iconPx, height: iconPx }}
                className="text-muted-foreground"
              />
            }
          />
        )}
      </div>
      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
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
          className="h-5 px-1 py-0 text-[11px] font-mono-tight w-full"
          spellCheck={false}
        />
      ) : (
        <span
          className="w-full break-words text-[11px] leading-tight font-mono-tight line-clamp-2"
          title={node.name}
        >
          {node.name}
          {isDir ? '/' : ''}
        </span>
      )}
      {isDir && !editing && counts && (counts.files > 0 || counts.dirs > 0) && (
        <span className="text-muted-foreground/60 text-[9px] tabular-nums">
          {counts.files}f · {counts.dirs}d
        </span>
      )}
    </div>
  );
}

export const TreeGridItem = memo(TreeGridItemInner);
