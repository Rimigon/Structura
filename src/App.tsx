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
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePresetStore, useTreeStore, useUIStore } from '@/stores';
import { THEMES } from '@/stores/uiStore';

export default function App() {
  useHotkeys();
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
  }, []);

  return (
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
      </div>
    </TooltipProvider>
  );
}
