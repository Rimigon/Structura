import { memo, useEffect, useRef, useState } from 'react';
import { File as FileIcon, Folder } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { FileNode, NodeId, TreeNode } from '@/types';
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
  thumbPx: number;
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

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function TreeTileItemInner({
  node,
  thumbPx,
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

  const file = node.kind === 'file' ? (node as FileNode) : null;
  const meta = file
    ? `${(file.ext || t('nd.kind.file')).toUpperCase()} · ${humanSize(file.size)}`
    : counts
      ? `${t('nd.kind.dir')} · ${counts.files}/${counts.dirs}`
      : t('nd.kind.dir');

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
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${thumbPx + 20}px` }}
      className={cn(
        'group relative flex items-center gap-2 rounded-md border p-2 cursor-pointer select-none transition-colors',
        'hover:bg-accent/50',
        diffClass,
        selected && 'bg-primary/25 ring-1 ring-primary/70',
        inMultiSelect && !selected && 'bg-primary/15 ring-1 ring-primary/40',
        highlight && !selected && !inMultiSelect && 'bg-accent/40 ring-1 ring-primary/50',
      )}
    >
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted/30"
        style={{ width: thumbPx, height: thumbPx }}
      >
        {isDir ? (
          <Folder style={{ width: thumbPx * 0.6, height: thumbPx * 0.6 }} className="text-primary" />
        ) : (
          <FileThumbnail
            node={node}
            size={thumbSize}
            className="max-h-full max-w-full object-contain"
            fallback={
              <FileIcon
                style={{ width: thumbPx * 0.6, height: thumbPx * 0.6 }}
                className="text-muted-foreground"
              />
            }
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
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
            className="h-5 px-1 py-0 text-xs font-mono-tight w-full"
            spellCheck={false}
          />
        ) : (
          <div className="truncate text-xs font-mono-tight">
            {node.name}
            {isDir ? '/' : ''}
          </div>
        )}
        <div className="truncate text-[10px] text-muted-foreground">{meta}</div>
      </div>
      <div className="absolute right-1 top-1">
        <DiffBadge dirty={node.dirty} />
      </div>
    </div>
  );
}

export const TreeTileItem = memo(TreeTileItemInner);
