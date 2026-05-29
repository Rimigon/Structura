import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, File as FileIcon, Folder } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { DirNode, FileNode, NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { cn } from '@/lib/cn';
import { MonoText } from '@/components/common/MonoText';
import { Input } from '@/components/ui/input';
import { useSelectionStore, useTreeStore } from '@/stores';
import { useLocale, useT } from '@/lib/i18n';
import { countDirectChildren } from '@/core/tree/traverse';
import { DiffBadge } from './DiffBadge';
import { FileThumbnail } from './FileThumbnail';

/** Shared grid template so the header and rows stay column-aligned. */
export const DETAILS_COLS =
  'grid grid-cols-[minmax(0,1fr)_64px_84px_150px] items-center gap-2';

interface Props {
  node: TreeNode;
  depth: number;
  /** Preview/icon box size (px) in the name cell. */
  thumbPx: number;
  /** Backend thumbnail request size (px). */
  thumbSize: number;
  /** Row position — drives zebra striping. */
  index: number;
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
  new: 'border-l-2 border-diff-added',
  moved: 'border-l-2 border-diff-moved',
  renamed: 'border-l-2 border-diff-renamed',
  deleted: 'border-l-2 border-diff-removed line-through opacity-60',
};

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function TreeDetailsRowInner({
  node,
  depth,
  thumbPx,
  thumbSize,
  index,
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
  const expanded = isDir ? (node as DirNode).expanded : false;
  const diffClass = node.dirty ? DIFF_CLASS[node.dirty] : '';
  const t = useT();
  const locale = useLocale();

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

  return (
    <div
      role="treeitem"
      aria-expanded={isDir ? expanded : undefined}
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
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${Math.max(26, thumbPx + 8)}px` }}
      className={cn(
        DETAILS_COLS,
        'px-2 py-0.5 cursor-pointer select-none text-xs',
        'hover:bg-accent/60',
        !selected &&
          !inMultiSelect &&
          !highlight &&
          index % 2 === 1 &&
          'bg-foreground/[0.04]',
        selected && 'bg-primary/25 ring-1 ring-primary/70',
        inMultiSelect && !selected && 'bg-primary/15 ring-1 ring-primary/40',
        highlight && !selected && !inMultiSelect && 'bg-accent/40 ring-1 ring-primary/50',
        diffClass,
      )}
    >
      {/* Name cell */}
      <div
        className="flex items-center gap-1 min-w-0"
        style={{ paddingLeft: depth * 14 }}
      >
        {isDir ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={expanded ? t('tree.collapse') : t('tree.expand')}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        {isDir ? (
          <Folder
            style={{ width: thumbPx, height: thumbPx }}
            className="shrink-0 text-primary"
          />
        ) : (
          <FileThumbnail
            node={node}
            size={thumbSize}
            style={{ width: thumbPx, height: thumbPx }}
            className="shrink-0 rounded object-cover"
            fallback={
              <FileIcon
                style={{ width: thumbPx, height: thumbPx }}
                className="shrink-0 text-muted-foreground"
              />
            }
          />
        )}
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
            className="h-5 px-1 py-0 text-xs font-mono-tight flex-1"
            spellCheck={false}
          />
        ) : (
          <MonoText className="flex-1 truncate">
            {node.name}
            {isDir ? '/' : ''}
          </MonoText>
        )}
        <DiffBadge dirty={node.dirty} />
      </div>

      {/* Type */}
      <span className="text-muted-foreground truncate">
        {t(`nd.kind.${node.kind}`)}
      </span>

      {/* Size / child count */}
      <span className="text-muted-foreground tabular-nums text-right">
        {file
          ? humanSize(file.size)
          : counts
            ? `${counts.files}/${counts.dirs}`
            : '—'}
      </span>

      {/* Modified */}
      <span className="text-muted-foreground/80 tabular-nums truncate">
        {file && file.modified > 0
          ? new Date(file.modified).toLocaleDateString(
              locale === 'ru' ? 'ru-RU' : 'en-US',
            )
          : '—'}
      </span>
    </div>
  );
}

export const TreeDetailsRow = memo(TreeDetailsRowInner);
