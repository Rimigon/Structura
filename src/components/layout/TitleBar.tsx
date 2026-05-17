import { useEffect, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Cog,
  Eye,
  FileSearch,
  FolderOpen,
  History,
  PanelLeft,
  PanelRight,
  PictureInPicture,
  Save,
  Undo2,
  Redo2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/cn';
import { openFloatingWidget, pickDirectory } from '@/lib/tauri';
import { useTreeStore, useUIStore, undoTree, redoTree } from '@/stores';
import { useT } from '@/lib/i18n';
import { ThemePicker } from './ThemePicker';

function parentOf(path: string): string | null {
  const normalized = path.replace(/[\\/]+$/, '');
  const idx = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (idx <= 0) return null;
  const parent = normalized.slice(0, idx);
  if (/^[A-Za-z]:$/.test(parent)) return parent + '\\';
  return parent;
}

export function TitleBar() {
  const scanRoot = useTreeStore(s => s.scanRoot);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const loading = useTreeStore(s => s.loading);
  const setApplyDialogOpen = useUIStore(s => s.setApplyDialogOpen);
  const setHistoryDialogOpen = useUIStore(s => s.setHistoryDialogOpen);
  const setDedupDialogOpen = useUIStore(s => s.setDedupDialogOpen);
  const setWatchersDialogOpen = useUIStore(s => s.setWatchersDialogOpen);
  const setSettingsDialogOpen = useUIStore(s => s.setSettingsDialogOpen);
  const setHelpDialogOpen = useUIStore(s => s.setHelpDialogOpen);
  const leftPanelVisible = useUIStore(s => s.leftPanelVisible);
  const rightPanelVisible = useUIStore(s => s.rightPanelVisible);
  const toggleLeftPanel = useUIStore(s => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore(s => s.toggleRightPanel);
  const dirtyCount = useTreeStore(s =>
    Object.values(s.nodes).filter(n => n.dirty).length,
  );
  const t = useT();

  const [pathInput, setPathInput] = useState(rootFsPath ?? '');
  useEffect(() => {
    setPathInput(rootFsPath ?? '');
  }, [rootFsPath]);

  const handleOpen = async () => {
    const path = await pickDirectory().catch(() => null);
    if (path) await scanRoot(path);
  };

  const handleRefresh = async () => {
    if (rootFsPath) await scanRoot(rootFsPath);
  };

  const handleUp = async () => {
    if (!rootFsPath) return;
    const parent = parentOf(rootFsPath);
    if (parent) await scanRoot(parent);
  };

  const handleSubmitPath = async () => {
    const p = pathInput.trim();
    if (p && p !== rootFsPath) await scanRoot(p);
  };

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 glass">
      <div className="flex items-center gap-2">
        <span className="font-mono-tight font-semibold text-base">Structura</span>
      </div>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        disabled={loading}
        aria-label={t('titlebar.open')}
      >
        <FolderOpen className="h-4 w-4" />
        {t('titlebar.open')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        disabled={loading || !rootFsPath || !parentOf(rootFsPath)}
        aria-label={t('titlebar.up')}
        title={t('titlebar.up')}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading || !rootFsPath}
        aria-label={t('titlebar.refresh')}
      >
        <RefreshCw className="h-4 w-4" />
        {t('titlebar.refresh')}
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleLeftPanel}
        aria-label={t('titlebar.toggleLeft')}
        title={t('titlebar.toggleLeft')}
        aria-pressed={!leftPanelVisible}
      >
        <PanelLeft
          className={cn(
            'h-4 w-4',
            !leftPanelVisible && 'text-muted-foreground/50',
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleRightPanel}
        aria-label={t('titlebar.toggleRight')}
        title={t('titlebar.toggleRight')}
        aria-pressed={!rightPanelVisible}
      >
        <PanelRight
          className={cn(
            'h-4 w-4',
            !rightPanelVisible && 'text-muted-foreground/50',
          )}
        />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => undoTree()}
        aria-label={t('titlebar.undo')}
        title={t('titlebar.undo')}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => redoTree()}
        aria-label={t('titlebar.redo')}
        title={t('titlebar.redo')}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setHistoryDialogOpen(true)}
        aria-label={t('titlebar.history')}
        title={t('titlebar.history')}
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDedupDialogOpen(true)}
        disabled={!rootFsPath}
        aria-label={t('titlebar.dedup')}
        title={t('titlebar.dedup')}
      >
        <FileSearch className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setWatchersDialogOpen(true)}
        aria-label={t('titlebar.watchers')}
        title={t('titlebar.watchers')}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => openFloatingWidget().catch(() => void 0)}
        aria-label={t('titlebar.widget')}
        title={t('titlebar.widget')}
      >
        <PictureInPicture className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setHelpDialogOpen(true)}
        aria-label={t('titlebar.help')}
        title={t('titlebar.help')}
      >
        <BookOpen className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSettingsDialogOpen(true)}
        aria-label={t('titlebar.settings')}
        title={t('titlebar.settings')}
      >
        <Cog className="h-4 w-4" />
      </Button>
      <Input
        value={pathInput}
        onChange={e => setPathInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmitPath();
          }
        }}
        onBlur={handleSubmitPath}
        placeholder={t('titlebar.pathPlaceholder')}
        className="flex-1 h-8 font-mono-tight text-xs"
      />
      <Button
        variant="default"
        size="sm"
        disabled={dirtyCount === 0}
        onClick={() => setApplyDialogOpen(true)}
      >
        <Save className="h-4 w-4" />
        {t('titlebar.applyButton')}
        {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
      </Button>
      <ThemePicker />
    </div>
  );
}
