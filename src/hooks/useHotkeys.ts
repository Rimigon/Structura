import { useEffect } from 'react';
import { useSelectionStore, useTreeHistory, useTreeStore, useUIStore } from '@/stores';
import { pickDirectory } from '@/lib/tauri';

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  return target.isContentEditable;
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const inInput = isTextInput(e.target);

      if (mod && e.code === 'KeyZ' && !e.shiftKey) {
        if (inInput) return;
        e.preventDefault();
        useTreeHistory().getState().undo();
        return;
      }
      if (mod && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
        if (inInput) return;
        e.preventDefault();
        useTreeHistory().getState().redo();
        return;
      }
      if (mod && e.code === 'KeyS') {
        e.preventDefault();
        useUIStore.getState().setApplyDialogOpen(true);
        return;
      }
      if (mod && e.code === 'KeyO') {
        e.preventDefault();
        const path = await pickDirectory().catch(() => null);
        if (path) await useTreeStore.getState().scanRoot(path);
        return;
      }
      if (mod && e.code === 'KeyF') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-tree-search]');
        input?.focus();
        input?.select();
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        const root = useTreeStore.getState().rootFsPath;
        if (root) await useTreeStore.getState().scanRoot(root);
        return;
      }
      if (e.key === 'F2') {
        if (inInput) return;
        const sel = useSelectionStore.getState().focusedId;
        if (sel) {
          e.preventDefault();
          useSelectionStore.getState().startEditing(sel);
        }
        return;
      }
      if (e.key === 'Delete') {
        if (inInput) return;
        const sel = useSelectionStore.getState().focusedId;
        if (sel) {
          e.preventDefault();
          useTreeStore.getState().deleteNode(sel);
        }
        return;
      }
      if (e.key === 'Tab' && !inInput) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        e.preventDefault();
        if (e.shiftKey) useTreeStore.getState().outdentNode(sel);
        else useTreeStore.getState().indentNode(sel);
        return;
      }
      if (e.key === 'Enter' && !inInput) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        const tree = useTreeStore.getState();
        const node = tree.nodes[sel];
        if (!node) return;
        e.preventDefault();
        if (e.altKey) {
          const parentId = node.kind === 'dir' ? node.id : node.parentId;
          if (!parentId) return;
          const newId = tree.createNode(parentId, 'dir', 'новая-папка');
          if (newId) {
            useSelectionStore.getState().focus(newId);
            useSelectionStore.getState().startEditing(newId);
          }
        } else {
          const parentId = node.kind === 'dir' ? node.id : node.parentId;
          if (!parentId) return;
          const newId = tree.createNode(parentId, 'file', 'новый-файл');
          if (newId) {
            useSelectionStore.getState().focus(newId);
            useSelectionStore.getState().startEditing(newId);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
