import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseText } from '@/core/parser';
import { useTreeStore, useUIStore } from '@/stores';
import { isTauri, pickOpenFile, readTextFile } from '@/lib/tauri';
import { useT } from '@/lib/i18n';

const EXAMPLE = `proj/
\tsrc/
\t\tmain.ts
\tREADME.md`;

export function ImportDialog() {
  const open = useUIStore(s => s.importDialogOpen);
  const setOpen = useUIStore(s => s.setImportDialogOpen);
  const [text, setText] = useState(EXAMPLE);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const handleImport = () => {
    try {
      const state = parseText(text);
      useTreeStore.setState({
        rootId: state.rootId,
        nodes: state.nodes,
        rootFsPath: null,
        error: null,
      });
      setOpen(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpenFile = async () => {
    setError(null);
    try {
      if (!isTauri()) {
        setError(t('import.tauriOnly'));
        return;
      }
      const path = await pickOpenFile(t('import.fileFilter'), ['txt', 'md', 'json']);
      if (!path) return;
      const content = await readTextFile(path);
      setText(content);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
          <DialogDescription>{t('import.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenFile}>
            <FolderOpen className="h-3.5 w-3.5" />
            {t('import.openFile')}
          </Button>
        </div>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="font-mono-tight min-h-[240px]"
          spellCheck={false}
        />
        {error && (
          <div className="text-sm text-destructive font-mono-tight">{error}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleImport}>{t('import.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
