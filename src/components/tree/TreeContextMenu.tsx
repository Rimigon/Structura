import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardPaste,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
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
import { fsPathOf } from '@/core/tree/traverse';
import { revealInOs, isTauri } from '@/lib/tauri';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';
import { defaultNodeName, useT } from '@/lib/i18n';

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
  const t = useT();

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

  // Selection context: if multi-select includes the clicked node, operate on the set.
  const sel = useSelectionStore.getState();
  const multi =
    sel.multiSelect.has(nodeId) && sel.multiSelect.size > 1
      ? Array.from(sel.multiSelect)
      : null;

  const items: Item[] = [];

  if (isDir && !isRoot && node.originalPath) {
    items.push({
      icon: FolderOpen,
      label: t('tree.open_as_root'),
      onClick: () => useTreeStore.getState().scanRoot(node.originalPath!),
    });
  }

  if (isDir) {
    items.push({
      icon: FilePlus2,
      label: t('tree.new_file'),
      onClick: () => {
        const id = useTreeStore.getState().createNode(nodeId, 'file', defaultNodeName('file'));
        if (id) {
          useSelectionStore.getState().focus(id);
          useSelectionStore.getState().startEditing(id);
        }
      },
    });
    items.push({
      icon: FolderPlus,
      label: t('tree.new_folder'),
      onClick: () => {
        const id = useTreeStore.getState().createNode(nodeId, 'dir', defaultNodeName('dir'));
        if (id) {
          useSelectionStore.getState().focus(id);
          useSelectionStore.getState().startEditing(id);
        }
      },
    });
  }

  // Inline rename is only meaningful for a single target.
  if (!multi) {
    items.push({
      icon: Pencil,
      label: t('tree.rename'),
      onClick: () => useSelectionStore.getState().startEditing(nodeId),
    });
  }

  if (!isRoot) {
    const selCount = multi?.length ?? 1;
    items.push({
      icon: Copy,
      label: selCount > 1 ? t('tree.copy') + ` (${selCount})` : t('tree.copy'),
      onClick: () => {
        const sel = useSelectionStore.getState();
        const ids = multi ?? [nodeId];
        sel.setClipboard({ ids, mode: 'copy' });
      },
    });
    items.push({
      icon: Scissors,
      label: selCount > 1 ? t('tree.cut') + ` (${selCount})` : t('tree.cut'),
      onClick: () => {
        const sel = useSelectionStore.getState();
        const ids = multi ?? [nodeId];
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
        label:
          clip.mode === 'cut'
            ? t('tree.paste_cut', { n: clip.ids.length })
            : t('tree.paste_copy', { n: clip.ids.length }),
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

  // Mass copy names / paths ------------------------------------------------
  if (multi) {
    items.push({
      icon: FileText,
      label: t('tree.copy_names', { n: multi.length }),
      onClick: async () => {
        const state = useTreeStore.getState();
        const text = multi
          .map(id => state.nodes[id]?.name)
          .filter((n): n is string => !!n)
          .join('\n');
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard may be denied in Tauri webview — ignore */
        }
      },
    });
    items.push({
      icon: Copy,
      label: t('tree.copy_paths', { n: multi.length }),
      onClick: async () => {
        const state = useTreeStore.getState();
        const text = multi
          .map(id => fsPathOf(state, id) ?? state.nodes[id]?.originalPath ?? '')
          .filter(p => !!p)
          .join('\n');
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* ignore */
        }
      },
    });
  }

  // Folder-level batch rename (renames children). Always available for folders.
  if (isDir) {
    items.push({
      icon: Wand2,
      label: t('tree.batch_rename'),
      onClick: () => useUIStore.getState().setBatchRenameTarget(nodeId),
    });
  }

  // Selection-level batch rename (renames the selected nodes themselves).
  if (multi && multi.length > 0) {
    items.push({
      icon: Wand2,
      label: t('tree.batch_rename_selection', { n: multi.length }),
      onClick: () => useUIStore.getState().setBatchRenameSelection(multi),
    });
  }

  if (isDir && !isRoot) {
    items.push({
      icon: Layers,
      label: t('tree.flatten_into'),
      onClick: () => {
        const tree = useTreeStore.getState();
        const res = flatten(tree, nodeId, { ...DEFAULT_FLATTEN_CONFIG, mode: 'into-target' });
        if (res.tx.ops.length > 0) tree.applyOps(res.tx.ops);
      },
    });
    items.push({
      icon: FolderMinus,
      label: t('tree.dissolve'),
      onClick: () => {
        const tree = useTreeStore.getState();
        const res = flatten(tree, nodeId, { ...DEFAULT_FLATTEN_CONFIG, mode: 'dissolve' });
        if (res.tx.ops.length > 0) tree.applyOps(res.tx.ops);
      },
    });
  }

  if (node.originalPath && !multi) {
    items.push({
      icon: Copy,
      label: t('tree.copy_path'),
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
        label: t('tree.reveal'),
        onClick: () => revealInOs(node.originalPath!).catch(() => void 0),
      });
    }
  }

  if (!isRoot) {
    items.push({
      icon: Trash2,
      label: multi ? t('tree.delete') + ` (${multi.length})` : t('tree.delete'),
      danger: true,
      onClick: () => {
        const tree = useTreeStore.getState();
        const ids = multi ?? [nodeId];
        for (const id of ids) tree.deleteNode(id);
      },
    });
  }

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className="neumorphic fixed z-50 min-w-[220px] rounded-md border border-border py-1 text-sm shadow-lg"
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
