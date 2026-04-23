import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface UIState {
  leftPanelSize: number;
  rightPanelSize: number;
  theme: ThemeId;
  importDialogOpen: boolean;
  exportDialogOpen: boolean;
  applyDialogOpen: boolean;
  historyDialogOpen: boolean;
  setPanelSizes(left: number, right: number): void;
  setTheme(theme: ThemeId): void;
  setImportDialogOpen(open: boolean): void;
  setExportDialogOpen(open: boolean): void;
  setApplyDialogOpen(open: boolean): void;
  setHistoryDialogOpen(open: boolean): void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      leftPanelSize: 20,
      rightPanelSize: 25,
      theme: 'structura-dark',
      importDialogOpen: false,
      exportDialogOpen: false,
      applyDialogOpen: false,
      historyDialogOpen: false,
      setPanelSizes: (left, right) =>
        set({ leftPanelSize: left, rightPanelSize: right }),
      setTheme: theme => set({ theme }),
      setImportDialogOpen: open => set({ importDialogOpen: open }),
      setExportDialogOpen: open => set({ exportDialogOpen: open }),
      setApplyDialogOpen: open => set({ applyDialogOpen: open }),
      setHistoryDialogOpen: open => set({ historyDialogOpen: open }),
    }),
    {
      name: 'structura-ui',
      version: 2,
      partialize: state => ({
        leftPanelSize: state.leftPanelSize,
        rightPanelSize: state.rightPanelSize,
        theme: state.theme,
      }),
    },
  ),
);
