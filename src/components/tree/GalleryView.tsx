import { File as FileIcon, Folder } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { FileNode, NodeId, TreeNode } from '@/types';
import type { SelectMods } from '@/stores/selectionStore';
import { cn } from '@/lib/cn';
import { useSelectionStore } from '@/stores';
import { useT } from '@/lib/i18n';
import { FileThumbnail, isMediaNode } from './FileThumbnail';

interface Props {
  rows: TreeNode[];
  focusedId: NodeId | null;
  multiSelect: Set<NodeId>;
  stripThumb: number;
  onSelect: (id: NodeId, mods: SelectMods) => void;
  onToggle: (id: NodeId) => void;
  onContextMenu: (id: NodeId, x: number, y: number) => void;
}

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function GalleryView({
  rows,
  focusedId,
  multiSelect,
  stripThumb,
  onSelect,
  onToggle,
  onContextMenu,
}: Props) {
  const t = useT();
  const focused =
    (focusedId && rows.find(n => n.id === focusedId)) || rows[0] || null;
  const focusedFile = focused && focused.kind === 'file' ? (focused as FileNode) : null;

  const ctx = (e: MouseEvent, id: NodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const ms = useSelectionStore.getState().multiSelect;
    if (!(ms.size > 1 && ms.has(id))) onSelect(id, { ctrl: false, shift: false });
    else useSelectionStore.getState().focus(id);
    onContextMenu(id, e.clientX, e.clientY);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Big preview of the focused item */}
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 p-4">
        {focused ? (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {isMediaNode(focused) ? (
                <FileThumbnail
                  node={focused}
                  size={512}
                  eager
                  className="max-h-full max-w-full rounded-md object-contain shadow-lg"
                  fallback={<FileIcon className="h-24 w-24 text-muted-foreground" />}
                />
              ) : focused.kind === 'dir' ? (
                <Folder className="h-28 w-28 text-primary" />
              ) : (
                <FileIcon className="h-24 w-24 text-muted-foreground" />
              )}
            </div>
            <div className="shrink-0 text-center">
              <div className="truncate text-sm font-mono-tight" title={focused.name}>
                {focused.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {focusedFile
                  ? `${(focusedFile.ext || t('nd.kind.file')).toUpperCase()} · ${humanSize(focusedFile.size)}`
                  : t('nd.kind.dir')}
              </div>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{t('common.empty')}</span>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="shrink-0 overflow-x-auto border-t border-border bg-muted/20 p-2 scrollbar-thin">
        <div className="flex gap-2">
          {rows.map(node => {
            const isDir = node.kind === 'dir';
            const sel = focusedId === node.id;
            const inMulti = multiSelect.has(node.id);
            return (
              <button
                key={node.id}
                type="button"
                onClick={e =>
                  onSelect(node.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
                }
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (isDir) onToggle(node.id);
                }}
                onContextMenu={e => ctx(e, node.id)}
                title={node.name}
                style={{
                  width: stripThumb,
                  contentVisibility: 'auto',
                  containIntrinsicSize: `${stripThumb}px ${stripThumb}px`,
                }}
                className={cn(
                  'shrink-0 overflow-hidden rounded border bg-background/40 p-1',
                  sel
                    ? 'border-primary ring-1 ring-primary/70'
                    : inMulti
                      ? 'border-primary/50'
                      : 'border-border/60 hover:border-primary/40',
                )}
              >
                <div
                  className="flex items-center justify-center overflow-hidden rounded"
                  style={{ height: stripThumb * 0.7 }}
                >
                  {isDir ? (
                    <Folder className="h-7 w-7 text-primary" />
                  ) : (
                    <FileThumbnail
                      node={node}
                      size={96}
                      className="max-h-full max-w-full object-contain"
                      fallback={<FileIcon className="h-6 w-6 text-muted-foreground" />}
                    />
                  )}
                </div>
                <div className="truncate text-[9px] leading-tight text-muted-foreground">
                  {node.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
