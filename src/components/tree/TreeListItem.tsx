import { memo, useEffect, useRef, useState } from 'react';
import { File as FileIcon, Folder } from 'lucide-react';
import type { NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { cn } from '@/lib/cn';
import { MonoText } from '@/components/common/MonoText';
import { Input } from '@/components/ui/input';
import { useSelectionStore } from '@/stores';
import { DiffBadge } from './DiffBadge';
import { FileThumbnail } from './FileThumbnail';

interface Props {
  node: TreeNode;
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

function TreeListItemInner({
  node,
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
  const diffClass = node.dirty ? DIFF_CLASS[node.dirty] : '';

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
      className={cn(
        'flex items-center gap-1.5 break-inside-avoid rounded-sm px-2 py-[3px] cursor-pointer select-none',
        'hover:bg-accent/60',
        selected && 'bg-primary/25 ring-1 ring-primary/70',
        inMultiSelect && !selected && 'bg-primary/15 ring-1 ring-primary/40',
        highlight && !selected && !inMultiSelect && 'bg-accent/40 ring-1 ring-primary/50',
        diffClass,
      )}
    >
      {isDir ? (
        <Folder className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <FileThumbnail
          node={node}
          size={48}
          className="h-4 w-4 shrink-0 rounded-[2px] object-cover"
          fallback={<FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
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
        <MonoText className="flex-1 truncate text-xs">
          {node.name}
          {isDir ? '/' : ''}
        </MonoText>
      )}
      <DiffBadge dirty={node.dirty} />
    </div>
  );
}

export const TreeListItem = memo(TreeListItemInner);
