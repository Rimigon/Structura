import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardPaste,
  Copy,
  ExternalLink,
  FilePlus2,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  Layers,
  Pencil,
  Scissors,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { NodeId, TreeState } from '@/types';
import { DEFAULT_FLATTEN_CONFIG } from '@/types';
import { flatten } from '@/core/flatten/flatten';
import { revealInOs, isTauri } from '@/lib/tauri';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';

interface Props {
  x: number;
  y: number;
  nodeId: NodeId;
  onClose: () => void;
}

interface Item {
  icon: typeof Copy;
  label: string;
  danger?: boolean;
  onClick: () => void | Promise<void>;
}

export function TreeContextMenu({ x, y, nodeId, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nx = x + rect.width > vw ? Math.max(4, vw - rect.width - 4) : x;
    const ny = y + rect.height > vh ? Math.max(4, vh - rect.height - 4) : y;
    if (nx !== pos.x || ny !== pos.y) setPos({ x: nx, y: ny });
  }, [x, y, pos.x, pos.y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const tree = useTreeStore.getState();
  const node = tree.nodes[nodeId];
  if (!node) return null;
  const isDir = node.kind === 'dir';
  const isRoot = node.id === tree.rootId;

  const items: Item[] = [];

  if (isDir && !isRoot && node.originalPath) {
    items.push({
      icon: FolderOpen,
      label: 'Открыть как корень',
      onClick: () => useTreeStore.getState().scanRoot(node.originalPath!),
    });
  }

  if (isDir) {
    items.push({
      icon: FilePlus2,
      label: 'Новый файл',
      onClick: () => {
        const id = useTreeStore.getState().createNode(nodeId, 'file', 'новый-файл');
        if (id) {
          useSelectionStore.getState().focus(id);
          useSelectionStore.getState().startEditing(id);
        }
      },
    });
    items.push({
      icon: FolderPlus,
      label: 'Новая папка',
      onClick: () => {
        const id = useTreeStore.getState().createNode(nodeId, 'dir', 'новая-папка');
        if (id) {
          useSelectionStore.getState().focus(id);
          useSelectionStore.getState().startEditing(id);
        }
      },
    });
  }

  items.push({
    icon: Pencil,
    label: 'Переименовать',
    onClick: () => useSelectionStore.getState().startEditing(nodeId),
  });

  if (!isRoot) {
    items.push({
      icon: Copy,
      label: 'Копировать',
      onClick: () => {
        const sel = useSelectionStore.getState();
        const ids = sel.multiSelect.size > 0
          ? Array.from(sel.multiSelect)
          : [nodeId];
        sel.setClipboard({ ids, mode: 'copy' });
      },
    });
    items.push({
      icon: Scissors,
      label: 'Вырезать',
      onClick: () => {
        const sel = useSelectionStore.getState();
        const ids = sel.multiSelect.size > 0
          ? Array.from(sel.multiSelect)
          : [nodeId];
        sel.setClipboard({ ids, mode: 'cut' });
      },
    });
  }

  {
    const clip = useSelectionStore.getState().clipboard;
    const pasteTargetId = isDir ? nodeId : node.parentId;
    if (clip && clip.ids.length > 0 && pasteTargetId) {
      items.push({
        icon: ClipboardPaste,
        label: `Вставить (${clip.mode === 'cut' ? 'вырезано' : 'копия'}: ${clip.ids.length})`,
        onClick: () => {
          const sel = useSelectionStore.getState();
          const tree = useTreeStore.getState();
          if (clip.mode === 'copy') {
            const created = tree.duplicateNodes(clip.ids, pasteTargetId);
            if (created.length > 0) sel.focus(created[0]!);
          } else {
            for (const id of clip.ids) tree.moveNode(id, pasteTargetId, null);
            sel.setClipboard(null);
          }
        },
      });
    }
  }

  if (isDir) {
    items.push({
      icon: Wand2,
      label: 'Переименовать по шаблону…',
      onClick: () => useUIStore.getState().setBatchRenameTarget(nodeId),
    });
  }

  if (isDir && !isRoot) {
    items.push({
      icon: Layers,
      label: 'Свести в эту папку',
      onClick: () => {
        const t = useTreeStore.getState();
        const res = flatten(t, nodeId, { ...DEFAULT_FLATTEN_CONFIG, mode: 'into-target' });
        if (res.tx.ops.length > 0) t.applyOps(res.tx.ops);
      },
    });
    items.push({
      icon: FolderMinus,
      label: 'Схлопнуть папку (вытащить наружу)',
      onClick: () => {
        const t = useTreeStore.getState();
        const res = flatten(t, nodeId, { ...DEFAULT_FLATTEN_CONFIG, mode: 'dissolve' });
        if (res.tx.ops.length > 0) t.applyOps(res.tx.ops);
      },
    });
  }

  if (node.originalPath) {
    items.push({
      icon: Copy,
      label: 'Копировать путь',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(node.originalPath!);
        } catch {
          /* clipboard may be denied in Tauri webview — ignore */
        }
      },
    });
    if (isTauri()) {
      items.push({
        icon: ExternalLink,
        label: 'Показать в проводнике',
        onClick: () => revealInOs(node.originalPath!).catch(() => void 0),
      });
    }
  }

  if (!isRoot) {
    items.push({
      icon: Trash2,
      label: 'Удалить',
      danger: true,
      onClick: () => useTreeStore.getState().deleteNode(nodeId),
    });
  }

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className="neumorphic fixed z-50 min-w-[200px] rounded-md border border-border py-1 text-sm shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className={
              'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent focus:bg-accent focus:outline-none ' +
              (it.danger ? 'text-destructive' : '')
            }
            onClick={() => {
              void it.onClick();
              onClose();
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono-tight text-xs">{it.label}</span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: NodeId;
}

export function describeNode(state: TreeState, id: NodeId): string {
  return state.nodes[id]?.name ?? id;
}
