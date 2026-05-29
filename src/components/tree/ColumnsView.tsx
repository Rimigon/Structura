import { useEffect, useState } from 'react';
import { ChevronRight, File as FileIcon, Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { FileNode, NodeId, TreeNode } from '@/types';
import { cn } from '@/lib/cn';
import { MonoText } from '@/components/common/MonoText';
import { useSelectionStore, useTreeStore } from '@/stores';
import { useT } from '@/lib/i18n';
import { getChildren } from '@/core/tree/traverse';
import { FileThumbnail, isMediaNode } from './FileThumbnail';

interface Props {
  onContextMenu: (id: NodeId, x: number, y: number) => void;
}

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/** macOS Finder-style Miller columns: each selected folder opens its children in
 *  the next column to the right; selecting a file shows a preview column. */
export function ColumnsView({ onContextMenu }: Props) {
  const nodes = useTreeStore(s => s.nodes);
  const rootId = useTreeStore(s => s.rootId);
  const focusedId = useSelectionStore(s => s.focusedId);
  const t = useT();

  // Chain of selected folders (excluding the implicit root) — each one renders
  // the column to its right.
  const [path, setPath] = useState<NodeId[]>([]);

  useEffect(() => {
    setPath([]);
  }, [rootId]);

  if (!rootId) return null;

  // Drop any path entries whose node vanished (e.g. after a rescan/delete).
  const safePath: NodeId[] = [];
  for (const id of path) {
    const n = nodes[id];
    if (n && n.kind === 'dir' && n.dirty !== 'deleted') safePath.push(id);
    else break;
  }
  const chain: NodeId[] = [rootId, ...safePath];

  const handleClick = (
    e: MouseEvent,
    columnIndex: number,
    node: TreeNode,
    columnIds: NodeId[],
  ) => {
    useSelectionStore
      .getState()
      .select(node.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }, columnIds);
    if (node.kind === 'dir') {
      setPath([...safePath.slice(0, columnIndex), node.id]);
    } else {
      setPath(safePath.slice(0, columnIndex));
    }
  };

  const ctx = (e: MouseEvent, id: NodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const ms = useSelectionStore.getState().multiSelect;
    if (!(ms.size > 1 && ms.has(id))) {
      useSelectionStore.getState().select(id, { ctrl: false, shift: false }, []);
    } else {
      useSelectionStore.getState().focus(id);
    }
    onContextMenu(id, e.clientX, e.clientY);
  };

  const focusedNode = focusedId ? nodes[focusedId] : null;
  const showPreview = focusedNode && focusedNode.kind === 'file';
  const previewFile = showPreview ? (focusedNode as FileNode) : null;

  return (
    <div className="flex flex-1 min-h-0 overflow-x-auto scrollbar-thin">
      {chain.map((parentId, columnIndex) => {
        const children = getChildren({ nodes, rootId, rootFsPath: null }, parentId).filter(
          n => n.dirty !== 'deleted',
        );
        const columnIds = children.map(n => n.id);
        const nextSelected = chain[columnIndex + 1];
        return (
          <div
            key={parentId + columnIndex}
            className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-border scrollbar-thin"
          >
            {children.length === 0 ? (
              <div className="p-2 text-[11px] text-muted-foreground">{t('common.empty')}</div>
            ) : (
              children.map(node => {
                const isDir = node.kind === 'dir';
                const active = node.id === nextSelected || node.id === focusedId;
                return (
                  <div
                    key={node.id}
                    onClick={e => handleClick(e, columnIndex, node, columnIds)}
                    onContextMenu={e => ctx(e, node.id)}
                    title={node.name}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-1.5 px-2 py-1 text-xs',
                      'hover:bg-accent/60',
                      active && 'bg-primary/25',
                    )}
                  >
                    {isDir ? (
                      <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <FileThumbnail
                        node={node}
                        size={48}
                        className="h-4 w-4 shrink-0 rounded-[2px] object-cover"
                        fallback={<FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      />
                    )}
                    <MonoText className="flex-1 truncate">{node.name}</MonoText>
                    {isDir && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {/* Preview column for a selected file */}
      {previewFile && (
        <div className="flex w-72 shrink-0 flex-col items-center gap-3 overflow-y-auto p-4 scrollbar-thin">
          <div className="flex min-h-0 w-full items-center justify-center">
            {isMediaNode(previewFile) ? (
              <FileThumbnail
                node={previewFile}
                size={480}
                eager
                className="max-h-72 max-w-full rounded-md object-contain shadow"
                fallback={<FileIcon className="h-20 w-20 text-muted-foreground" />}
              />
            ) : (
              <FileIcon className="h-20 w-20 text-muted-foreground" />
            )}
          </div>
          <div className="w-full text-center">
            <div className="break-words text-sm font-mono-tight" title={previewFile.name}>
              {previewFile.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {(previewFile.ext || t('nd.kind.file')).toUpperCase()} · {humanSize(previewFile.size)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
