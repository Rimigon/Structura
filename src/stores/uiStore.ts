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
export type TreeViewMode =
  | 'tree' // hierarchical
  | 'list' // compact multi-column names (Windows "List")
  | 'tiles' // medium icon + name + meta (Windows "Tiles")
  | 'grid' // icon/thumbnail cards (Finder "Icons", Explorer "Large icons")
  | 'gallery' // big preview of focused item + thumbnail strip (Finder "Gallery")
  | 'details' // sortable table (Explorer "Details")
  | 'columns'; // Miller columns (Finder "Columns")

/** Modes where the preview/icon zoom slider applies. */
export const ZOOMABLE_VIEW_MODES: TreeViewMode[] = ['tiles', 'grid', 'gallery', 'details'];

/** Icon/preview zoom bounds for grid + details views. */
export const GRID_SIZE_MIN = 56;
export const GRID_SIZE_MAX = 280;
export const GRID_SIZE_STEP = 24;
export const GRID_SIZE_DEFAULT = 112;

export function clampGridSize(n: number): number {
  return Math.max(GRID_SIZE_MIN, Math.min(GRID_SIZE_MAX, Math.round(n)));
}

export type DetailsSortKey = 'name' | 'type' | 'size' | 'modified';
export interface DetailsSort {
  key: DetailsSortKey;
  dir: 'asc' | 'desc';
}
export const DEFAULT_DETAILS_SORT: DetailsSort = { key: 'name', dir: 'asc' };

export type HotkeyAction =
  | 'undo'
  | 'redo'
  | 'apply'
  | 'openFolder'
  | 'focusSearch'
  | 'selectAll'
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
  | 'togglePresets'
  | 'toggleInspector'
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
  'selectAll',
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
  'togglePresets',
  'toggleInspector',
  'help',
];

export const DEFAULT_HOTKEYS: Record<HotkeyAction, HotkeySpec> = {
  undo: { primary: 'KeyZ', ctrl: true },
  redo: { primary: 'KeyY', ctrl: true },
  apply: { primary: 'KeyS', ctrl: true },
  openFolder: { primary: 'KeyO', ctrl: true },
  focusSearch: { primary: 'KeyF', ctrl: true },
  selectAll: { primary: 'KeyA', ctrl: true },
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
  togglePresets: { primary: 'KeyB', ctrl: true },
  toggleInspector: { primary: 'KeyJ', ctrl: true },
  help: { primary: 'F1' },
};

export interface UINotification {
  message: string;
  level: 'info' | 'warn';
  /** Epoch ms — used to ignore stale auto-dismiss timers. */
  issuedAt: number;
}

interface UIState {
  leftPanelSize: number;
  rightPanelSize: number;
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  theme: ThemeId;
  locale: Locale;
  treeViewMode: TreeViewMode;
  /** Preview/icon size (px) for grid + details views. */
  gridSize: number;
  /** Column sort for the details view. */
  detailsSort: DetailsSort;
  hotkeys: Record<HotkeyAction, HotkeySpec>;
  importDialogOpen: boolean;
  exportDialogOpen: boolean;
  applyDialogOpen: boolean;
  historyDialogOpen: boolean;
  dedupDialogOpen: boolean;
  watchersDialogOpen: boolean;
  settingsDialogOpen: boolean;
  helpDialogOpen: boolean;
  updateDialogOpen: boolean;
  batchRenameTarget: string | null;
  /** When set, BatchRename renames these specific node IDs (instead of all children of a folder). */
  batchRenameSelection: string[] | null;
  notification: UINotification | null;
  /** When true, the app checks GitHub Releases for a newer version on launch (≤1×/day). */
  autoCheckUpdates: boolean;
  /** Epoch ms of the last attempt (used to throttle auto-checks to once per 24h). */
  lastUpdateCheckAt: number;
  setPanelSizes(left: number, right: number): void;
  toggleLeftPanel(): void;
  toggleRightPanel(): void;
  setTheme(theme: ThemeId): void;
  setLocale(locale: Locale): void;
  setTreeViewMode(mode: TreeViewMode): void;
  setGridSize(size: number): void;
  /** Toggle/raise the details sort key (asc → desc → asc on repeat). */
  toggleDetailsSort(key: DetailsSortKey): void;
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
  setUpdateDialogOpen(open: boolean): void;
  setAutoCheckUpdates(v: boolean): void;
  setLastUpdateCheckAt(t: number): void;
  setBatchRenameTarget(id: string | null): void;
  setBatchRenameSelection(ids: string[] | null): void;
  /** Auto-dismisses after 5s unless replaced. */
  pushNotification(message: string, level?: 'info' | 'warn'): void;
  clearNotification(): void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      leftPanelSize: 20,
      rightPanelSize: 25,
      leftPanelVisible: true,
      rightPanelVisible: true,
      theme: 'structura-dark',
      locale: 'ru',
      treeViewMode: 'tree',
      gridSize: GRID_SIZE_DEFAULT,
      detailsSort: { ...DEFAULT_DETAILS_SORT },
      hotkeys: { ...DEFAULT_HOTKEYS },
      importDialogOpen: false,
      exportDialogOpen: false,
      applyDialogOpen: false,
      historyDialogOpen: false,
      dedupDialogOpen: false,
      watchersDialogOpen: false,
      settingsDialogOpen: false,
      helpDialogOpen: false,
      updateDialogOpen: false,
      batchRenameTarget: null,
      batchRenameSelection: null,
      notification: null,
      autoCheckUpdates: true,
      lastUpdateCheckAt: 0,
      setPanelSizes: (left, right) =>
        set({ leftPanelSize: left, rightPanelSize: right }),
      toggleLeftPanel: () =>
        set(s => ({ leftPanelVisible: !s.leftPanelVisible })),
      toggleRightPanel: () =>
        set(s => ({ rightPanelVisible: !s.rightPanelVisible })),
      setTheme: theme => set({ theme }),
      setLocale: locale => set({ locale }),
      setTreeViewMode: mode => set({ treeViewMode: mode }),
      setGridSize: size => set({ gridSize: clampGridSize(size) }),
      toggleDetailsSort: key =>
        set(state => ({
          detailsSort:
            state.detailsSort.key === key
              ? { key, dir: state.detailsSort.dir === 'asc' ? 'desc' : 'asc' }
              : { key, dir: 'asc' },
        })),
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
      setUpdateDialogOpen: open => set({ updateDialogOpen: open }),
      setAutoCheckUpdates: v => set({ autoCheckUpdates: v }),
      setLastUpdateCheckAt: t => set({ lastUpdateCheckAt: t }),
      setBatchRenameTarget: id => set({ batchRenameTarget: id }),
      setBatchRenameSelection: ids => set({ batchRenameSelection: ids }),
      pushNotification: (message, level = 'info') => {
        const issuedAt = Date.now();
        set({ notification: { message, level, issuedAt } });
        setTimeout(() => {
          if (useUIStore.getState().notification?.issuedAt === issuedAt) {
            set({ notification: null });
          }
        }, 5000);
      },
      clearNotification: () => set({ notification: null }),
    }),
    {
      name: 'structura-ui',
      version: 8,
      partialize: state => ({
        leftPanelSize: state.leftPanelSize,
        rightPanelSize: state.rightPanelSize,
        leftPanelVisible: state.leftPanelVisible,
        rightPanelVisible: state.rightPanelVisible,
        theme: state.theme,
        locale: state.locale,
        treeViewMode: state.treeViewMode,
        gridSize: state.gridSize,
        detailsSort: state.detailsSort,
        hotkeys: state.hotkeys,
        autoCheckUpdates: state.autoCheckUpdates,
        lastUpdateCheckAt: state.lastUpdateCheckAt,
      }),
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<UIState>;
        let next: Partial<UIState> = p;
        if (version < 3) {
          next = {
            ...next,
            locale: next.locale ?? 'ru',
            hotkeys: next.hotkeys ?? { ...DEFAULT_HOTKEYS },
          };
        }
        if (version < 4) {
          next = {
            ...next,
            leftPanelVisible: next.leftPanelVisible ?? true,
            rightPanelVisible: next.rightPanelVisible ?? true,
            hotkeys: {
              ...DEFAULT_HOTKEYS,
              ...(next.hotkeys ?? {}),
            },
          };
        }
        // v4 → v5: auto-update preferences
        if (version < 5) {
          next = {
            ...next,
            autoCheckUpdates: next.autoCheckUpdates ?? true,
            lastUpdateCheckAt: next.lastUpdateCheckAt ?? 0,
          };
        }
        // v5 → v6: tree view modes + selectAll hotkey
        if (version < 6) {
          next = {
            ...next,
            treeViewMode: next.treeViewMode ?? 'tree',
            hotkeys: {
              ...DEFAULT_HOTKEYS,
              ...(next.hotkeys ?? {}),
            },
          };
        }
        // v6 → v7: grid/details preview zoom
        if (version < 7) {
          next = {
            ...next,
            gridSize: next.gridSize ?? GRID_SIZE_DEFAULT,
          };
        }
        // v7 → v8: more view modes + details column sort
        if (version < 8) {
          next = {
            ...next,
            detailsSort: next.detailsSort ?? { ...DEFAULT_DETAILS_SORT },
          };
        }
        return next as UIState;
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
