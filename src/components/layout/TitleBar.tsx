import { useEffect, useState } from 'react';
import { ArrowUp, FolderOpen, History, Save, Undo2, Redo2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { pickDirectory } from '@/lib/tauri';
import { useTreeStore, useUIStore, useTreeHistory } from '@/stores';
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
  const dirtyCount = useTreeStore(s =>
    Object.values(s.nodes).filter(n => n.dirty).length,
  );
  const history = useTreeHistory();

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
        aria-label="Открыть папку"
      >
        <FolderOpen className="h-4 w-4" />
        Открыть
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        disabled={loading || !rootFsPath || !parentOf(rootFsPath)}
        aria-label="На уровень выше"
        title="На уровень выше"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading || !rootFsPath}
        aria-label="Обновить"
      >
        <RefreshCw className="h-4 w-4" />
        Обновить
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => history.getState().undo()}
        aria-label="Отменить"
        title="Отменить"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => history.getState().redo()}
        aria-label="Повторить"
        title="Повторить"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setHistoryDialogOpen(true)}
        aria-label="История транзакций"
        title="История транзакций"
      >
        <History className="h-4 w-4" />
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
        placeholder="Путь к папке (Enter для открытия)"
        className="flex-1 h-8 font-mono-tight text-xs"
      />
      <Button
        variant="default"
        size="sm"
        disabled={dirtyCount === 0}
        onClick={() => setApplyDialogOpen(true)}
      >
        <Save className="h-4 w-4" />
        Применить{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
      </Button>
      <ThemePicker />
    </div>
  );
}
