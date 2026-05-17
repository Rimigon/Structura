import { useEffect } from 'react';
import { useSelectionStore, useTreeStore, useUIStore, undoTree, redoTree } from '@/stores';
import { matchHotkey, DEFAULT_HOTKEYS } from '@/stores/uiStore';
import type { HotkeySpec } from '@/stores/uiStore';
import { defaultNodeName } from '@/lib/i18n';
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
      const ui = useUIStore.getState();
      const hk = ui.hotkeys;
      const inInput = isTextInput(e.target);

      const match = (spec: HotkeySpec) => matchHotkey(e, spec);
      // Redo has an implicit alias (Ctrl+Shift+Z) alongside the configurable binding.
      const redoAlias: HotkeySpec = { primary: 'KeyZ', ctrl: true, shift: true };

      // --- Global (allowed in inputs too) ---------------------------------
      if (match(hk.apply)) {
        e.preventDefault();
        ui.setApplyDialogOpen(true);
        return;
      }
      if (match(hk.openFolder)) {
        e.preventDefault();
        const path = await pickDirectory().catch(() => null);
        if (path) await useTreeStore.getState().scanRoot(path);
        return;
      }
      if (match(hk.focusSearch)) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-tree-search]');
        input?.focus();
        input?.select();
        return;
      }
      if (match(hk.help) || matchHotkey(e, DEFAULT_HOTKEYS.help)) {
        e.preventDefault();
        ui.setHelpDialogOpen(true);
        return;
      }
      if (match(hk.togglePresets)) {
        e.preventDefault();
        ui.toggleLeftPanel();
        return;
      }
      if (match(hk.toggleInspector)) {
        e.preventDefault();
        ui.toggleRightPanel();
        return;
      }
      if (match(hk.rescan)) {
        e.preventDefault();
        const root = useTreeStore.getState().rootFsPath;
        if (root) await useTreeStore.getState().scanRoot(root);
        return;
      }

      // --- Skip if in a text input ---------------------------------------
      if (inInput) return;

      if (match(hk.undo)) {
        e.preventDefault();
        undoTree();
        return;
      }
      if (match(hk.redo) || match(redoAlias)) {
        e.preventDefault();
        redoTree();
        return;
      }
      if (match(hk.copyNames)) {
        // Must be checked before the plain copy binding since both use KeyC.
        const sel = useSelectionStore.getState();
        const tree = useTreeStore.getState();
        const ids =
          sel.multiSelect.size > 0
            ? Array.from(sel.multiSelect)
            : sel.focusedId
              ? [sel.focusedId]
              : [];
        if (ids.length === 0) return;
        e.preventDefault();
        const names = ids
          .map(id => tree.nodes[id]?.name)
          .filter((n): n is string => !!n)
          .join('\n');
        if (!names) return;
        try {
          await navigator.clipboard.writeText(names);
        } catch {
          /* clipboard may be denied — ignore */
        }
        return;
      }
      if (match(hk.copy) || match(hk.cut)) {
        const sel = useSelectionStore.getState();
        const ids =
          sel.multiSelect.size > 0
            ? Array.from(sel.multiSelect)
            : sel.focusedId
              ? [sel.focusedId]
              : [];
        if (ids.length === 0) return;
        e.preventDefault();
        sel.setClipboard({ ids, mode: match(hk.cut) ? 'cut' : 'copy' });
        return;
      }
      if (match(hk.paste)) {
        const sel = useSelectionStore.getState();
        const clip = sel.clipboard;
        if (!clip || clip.ids.length === 0) return;
        const tree = useTreeStore.getState();
        const focus = sel.focusedId;
        const focusNode = focus ? tree.nodes[focus] : null;
        const targetParentId =
          focusNode?.kind === 'dir'
            ? focusNode.id
            : focusNode?.parentId ?? tree.rootId;
        if (!targetParentId) return;
        e.preventDefault();
        if (clip.mode === 'copy') {
          const created = tree.duplicateNodes(clip.ids, targetParentId);
          if (created.length > 0) sel.focus(created[0]!);
        } else {
          for (const id of clip.ids) tree.moveNode(id, targetParentId, null);
          sel.setClipboard(null);
        }
        return;
      }
      if (match(hk.rename)) {
        const sel = useSelectionStore.getState().focusedId;
        if (sel) {
          e.preventDefault();
          useSelectionStore.getState().startEditing(sel);
        }
        return;
      }
      if (match(hk.delete)) {
        const sel = useSelectionStore.getState();
        const ids =
          sel.multiSelect.size > 0
            ? Array.from(sel.multiSelect)
            : sel.focusedId
              ? [sel.focusedId]
              : [];
        if (ids.length === 0) return;
        e.preventDefault();
        for (const id of ids) useTreeStore.getState().deleteNode(id);
        return;
      }
      if (match(hk.outdent)) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        e.preventDefault();
        useTreeStore.getState().outdentNode(sel);
        return;
      }
      if (match(hk.indent)) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        e.preventDefault();
        useTreeStore.getState().indentNode(sel);
        return;
      }
      if (match(hk.newFolder)) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        const tree = useTreeStore.getState();
        const node = tree.nodes[sel];
        if (!node) return;
        const parentId = node.kind === 'dir' ? node.id : node.parentId;
        if (!parentId) return;
        e.preventDefault();
        const newId = tree.createNode(parentId, 'dir', defaultNodeName('dir'));
        if (newId) {
          useSelectionStore.getState().focus(newId);
          useSelectionStore.getState().startEditing(newId);
        }
        return;
      }
      if (match(hk.newFile)) {
        const sel = useSelectionStore.getState().focusedId;
        if (!sel) return;
        const tree = useTreeStore.getState();
        const node = tree.nodes[sel];
        if (!node) return;
        const parentId = node.kind === 'dir' ? node.id : node.parentId;
        if (!parentId) return;
        e.preventDefault();
        const newId = tree.createNode(parentId, 'file', defaultNodeName('file'));
        if (newId) {
          useSelectionStore.getState().focus(newId);
          useSelectionStore.getState().startEditing(newId);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
