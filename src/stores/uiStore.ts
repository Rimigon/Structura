import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/lib/i18n';

export type ThemeId =
  | 'structura-dark'
  | 'structura-light'
  | 'dracula'
  | 'nord-dark'
  | 'solarized-dark'
  | 'solarized-light'
  | 'tokyo-night'
  | 'catppuccin-mocha'
  | 'monokai'
  | 'github-light'
  | 'github-dark'
  | 'one-dark'
  | 'one-light'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'rose-pine'
  | 'rose-pine-dawn'
  | 'material-ocean'
  | 'cobalt2'
  | 'ayu-mirage';

export const THEMES: { id: ThemeId; label: string; dark: boolean }[] = [
  { id: 'structura-dark', label: 'Structura Dark', dark: true },
  { id: 'structura-light', label: 'Structura Light', dark: false },
  { id: 'dracula', label: 'Dracula', dark: true },
  { id: 'nord-dark', label: 'Nord Dark', dark: true },
  { id: 'solarized-dark', label: 'Solarized Dark', dark: true },
  { id: 'solarized-light', label: 'Solarized Light', dark: false },
  { id: 'tokyo-night', label: 'Tokyo Night', dark: true },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', dark: true },
  { id: 'monokai', label: 'Monokai', dark: true },
  { id: 'github-light', label: 'GitHub Light', dark: false },
  { id: 'github-dark', label: 'GitHub Dark', dark: true },
  { id: 'one-dark', label: 'One Dark (Atom)', dark: true },
  { id: 'one-light', label: 'One Light (Atom)', dark: false },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', dark: true },
  { id: 'gruvbox-light', label: 'Gruvbox Light', dark: false },
  { id: 'rose-pine', label: 'Rosé Pine', dark: true },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', dark: false },
  { id: 'material-ocean', label: 'Material Ocean', dark: true },
  { id: 'cobalt2', label: 'Cobalt2', dark: true },
  { id: 'ayu-mirage', label: 'Ayu Mirage', dark: true },
];

// Hotkey configuration -----------------------------------------------------
export type HotkeyAction =
  | 'undo'
  | 'redo'
  | 'apply'
  | 'openFolder'
  | 'focusSearch'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'copyNames'
  | 'rescan'
  | 'rename'
  | 'delete'
  | 'indent'
  | 'outdent'
  | 'newFile'
  | 'newFolder'
  | 'help';

export interface HotkeySpec {
  /** `e.code` for letter keys (e.g. `KeyZ`) so physical layout matches. For function/special keys use `e.key` (`F2`, `Tab`, `Enter`, `Delete`, `F1`). */
  primary: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  'undo',
  'redo',
  'apply',
  'openFolder',
  'focusSearch',
  'copy',
  'cut',
  'paste',
  'copyNames',
  'rescan',
  'rename',
  'delete',
  'indent',
  'outdent',
  'newFile',
  'newFolder',
  'help',
];

export const DEFAULT_HOTKEYS: Record<HotkeyAction, HotkeySpec> = {
  undo: { primary: 'KeyZ', ctrl: true },
  redo: { primary: 'KeyY', ctrl: true },
  apply: { primary: 'KeyS', ctrl: true },
  openFolder: { primary: 'KeyO', ctrl: true },
  focusSearch: { primary: 'KeyF', ctrl: true },
  copy: { primary: 'KeyC', ctrl: true },
  cut: { primary: 'KeyX', ctrl: true },
  paste: { primary: 'KeyV', ctrl: true },
  copyNames: { primary: 'KeyC', ctrl: true, shift: true },
  rescan: { primary: 'F5' },
  rename: { primary: 'F2' },
  delete: { primary: 'Delete' },
  indent: { primary: 'Tab' },
  outdent: { primary: 'Tab', shift: true },
  newFile: { primary: 'Enter' },
  newFolder: { primary: 'Enter', alt: true },
  help: { primary: 'F1' },
};

interface UIState {
  leftPanelSize: number;
  rightPanelSize: number;
  theme: ThemeId;
  locale: Locale;
  hotkeys: Record<HotkeyAction, HotkeySpec>;
  importDialogOpen: boolean;
  exportDialogOpen: boolean;
  applyDialogOpen: boolean;
  historyDialogOpen: boolean;
  dedupDialogOpen: boolean;
  watchersDialogOpen: boolean;
  settingsDialogOpen: boolean;
  helpDialogOpen: boolean;
  batchRenameTarget: string | null;
  /** When set, BatchRename renames these specific node IDs (instead of all children of a folder). */
  batchRenameSelection: string[] | null;
  setPanelSizes(left: number, right: number): void;
  setTheme(theme: ThemeId): void;
  setLocale(locale: Locale): void;
  setHotkey(action: HotkeyAction, spec: HotkeySpec): void;
  resetHotkeys(): void;
  setImportDialogOpen(open: boolean): void;
  setExportDialogOpen(open: boolean): void;
  setApplyDialogOpen(open: boolean): void;
  setHistoryDialogOpen(open: boolean): void;
  setDedupDialogOpen(open: boolean): void;
  setWatchersDialogOpen(open: boolean): void;
  setSettingsDialogOpen(open: boolean): void;
  setHelpDialogOpen(open: boolean): void;
  setBatchRenameTarget(id: string | null): void;
  setBatchRenameSelection(ids: string[] | null): void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      leftPanelSize: 20,
      rightPanelSize: 25,
      theme: 'structura-dark',
      locale: 'ru',
      hotkeys: { ...DEFAULT_HOTKEYS },
      importDialogOpen: false,
      exportDialogOpen: false,
      applyDialogOpen: false,
      historyDialogOpen: false,
      dedupDialogOpen: false,
      watchersDialogOpen: false,
      settingsDialogOpen: false,
      helpDialogOpen: false,
      batchRenameTarget: null,
      batchRenameSelection: null,
      setPanelSizes: (left, right) =>
        set({ leftPanelSize: left, rightPanelSize: right }),
      setTheme: theme => set({ theme }),
      setLocale: locale => set({ locale }),
      setHotkey: (action, spec) =>
        set(state => ({ hotkeys: { ...state.hotkeys, [action]: spec } })),
      resetHotkeys: () => set({ hotkeys: { ...DEFAULT_HOTKEYS } }),
      setImportDialogOpen: open => set({ importDialogOpen: open }),
      setExportDialogOpen: open => set({ exportDialogOpen: open }),
      setApplyDialogOpen: open => set({ applyDialogOpen: open }),
      setHistoryDialogOpen: open => set({ historyDialogOpen: open }),
      setDedupDialogOpen: open => set({ dedupDialogOpen: open }),
      setWatchersDialogOpen: open => set({ watchersDialogOpen: open }),
      setSettingsDialogOpen: open => set({ settingsDialogOpen: open }),
      setHelpDialogOpen: open => set({ helpDialogOpen: open }),
      setBatchRenameTarget: id => set({ batchRenameTarget: id }),
      setBatchRenameSelection: ids => set({ batchRenameSelection: ids }),
    }),
    {
      name: 'structura-ui',
      version: 3,
      partialize: state => ({
        leftPanelSize: state.leftPanelSize,
        rightPanelSize: state.rightPanelSize,
        theme: state.theme,
        locale: state.locale,
        hotkeys: state.hotkeys,
      }),
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<UIState>;
        // v2 → v3: introduce locale + hotkeys
        if (version < 3) {
          return {
            ...p,
            locale: p.locale ?? 'ru',
            hotkeys: p.hotkeys ?? { ...DEFAULT_HOTKEYS },
          } as UIState;
        }
        return p as UIState;
      },
    },
  ),
);

// Hotkey helpers ----------------------------------------------------------

export function matchHotkey(e: KeyboardEvent, spec: HotkeySpec): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!!spec.ctrl !== mod) return false;
  if (!!spec.shift !== e.shiftKey) return false;
  if (!!spec.alt !== e.altKey) return false;
  if (spec.primary.startsWith('Key') || spec.primary.startsWith('Digit')) {
    return e.code === spec.primary;
  }
  return e.key === spec.primary;
}

export function formatHotkey(spec: HotkeySpec): string {
  const parts: string[] = [];
  if (spec.ctrl) parts.push('Ctrl');
  if (spec.shift) parts.push('Shift');
  if (spec.alt) parts.push('Alt');
  if (spec.primary.startsWith('Key')) parts.push(spec.primary.slice(3));
  else if (spec.primary.startsWith('Digit')) parts.push(spec.primary.slice(5));
  else parts.push(spec.primary);
  return parts.join('+');
}

/** Capture a hotkey from a keydown event. Returns null for pure modifier presses. */
export function captureHotkey(e: KeyboardEvent): HotkeySpec | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const primary =
    e.code.startsWith('Key') || e.code.startsWith('Digit') ? e.code : e.key;
  return {
    primary,
    ctrl: e.ctrlKey || e.metaKey || undefined,
    shift: e.shiftKey || undefined,
    alt: e.altKey || undefined,
  };
}
