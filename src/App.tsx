import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActionBar } from '@/components/layout/ActionBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { ThreePaneShell } from '@/components/layout/ThreePaneShell';
import { TreeCanvas } from '@/components/tree/TreeCanvas';
import { Inspector } from '@/components/inspector/Inspector';
import { PresetList } from '@/components/presets/PresetList';
import { ImportDialog } from '@/components/parser/ImportDialog';
import { ExportDialog } from '@/components/parser/ExportDialog';
import { ApplyDialog } from '@/components/parser/ApplyDialog';
import { TxHistoryDialog } from '@/components/parser/TxHistoryDialog';
import { DedupDialog } from '@/components/dedup/DedupDialog';
import { WatchersDialog } from '@/components/watcher/WatchersDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { BatchRenameDialog } from '@/components/rename/BatchRenameDialog';
import { HelpDialog } from '@/components/common/HelpDialog';
import { UpdateDialog } from '@/components/updater/UpdateDialog';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { UpdaterContext, useUpdater } from '@/hooks/useUpdater';
import { usePresetStore, useTreeStore, useUIStore, useWatcherStore } from '@/stores';
import { THEMES } from '@/stores/uiStore';
import { isTauri } from '@/lib/tauri';
import type { WatchEventPayload } from '@/lib/tauri';
import { listen } from '@tauri-apps/api/event';

export default function App() {
  useHotkeys();
  useAutoRefresh();
  const updater = useUpdater();
  const theme = useUIStore(s => s.theme);

  useEffect(() => {
    const meta = THEMES.find(t => t.id === theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', meta?.dark ?? true);
  }, [theme]);

  useEffect(() => {
    const { rootFsPath, rootId, scanRoot } = useTreeStore.getState();
    if (rootFsPath && !rootId) {
      scanRoot(rootFsPath).catch(() => {
        useTreeStore.setState({ rootFsPath: null });
      });
    }
    usePresetStore.getState().load();
    useWatcherStore.getState().load();

    if (!isTauri()) return;
    const unlistenWatch = listen<WatchEventPayload>('watch-event', ev => {
      useWatcherStore.getState().pushEvent(ev.payload);
    });
    const unlistenDrop = listen<string[]>('widget-dropped', async ev => {
      const paths = ev.payload;
      if (!paths || paths.length === 0) return;
      const first = paths[0]!;
      try {
        const { statPath } = await import('@/lib/tauri');
        const meta = await statPath(first);
        if (meta.isDir) {
          await useTreeStore.getState().scanRoot(first);
        }
      } catch {
        /* ignore */
      }
    });
    // Launched with a folder argument (Windows shell integration). The Rust
    // setup() emits this once the webview is up.
    const unlistenArg = listen<string>('open-folder-arg', async ev => {
      const path = ev.payload;
      if (!path) return;
      try {
        await useTreeStore.getState().scanRoot(path);
      } catch {
        /* ignore */
      }
    });
    return () => {
      unlistenWatch.then(fn => fn()).catch(() => void 0);
      unlistenDrop.then(fn => fn()).catch(() => void 0);
      unlistenArg.then(fn => fn()).catch(() => void 0);
    };
  }, []);

  return (
    <UpdaterContext.Provider value={updater}>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-screen w-screen flex-col bg-background text-foreground">
          <TitleBar />
          <ThreePaneShell
            left={<PresetList />}
            center={<TreeCanvas />}
            right={<Inspector />}
          />
          <ActionBar />
          <StatusBar />
          <ImportDialog />
          <ExportDialog />
          <ApplyDialog />
          <TxHistoryDialog />
          <DedupDialog />
          <WatchersDialog />
          <SettingsDialog />
          <BatchRenameDialog />
          <HelpDialog />
          <UpdateDialog />
        </div>
      </TooltipProvider>
    </UpdaterContext.Provider>
  );
}
