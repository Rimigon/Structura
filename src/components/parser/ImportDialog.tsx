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

const EXAMPLE = `proj/
\tsrc/
\t\tmain.ts
\tREADME.md`;

export function ImportDialog() {
  const open = useUIStore(s => s.importDialogOpen);
  const setOpen = useUIStore(s => s.setImportDialogOpen);
  const [text, setText] = useState(EXAMPLE);
  const [error, setError] = useState<string | null>(null);

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
        setError('Открытие файла доступно только в приложении Tauri.');
        return;
      }
      const path = await pickOpenFile('Дерево (txt, md, json)', ['txt', 'md', 'json']);
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
          <DialogTitle>Импорт дерева из текста</DialogTitle>
          <DialogDescription>
            Вставьте список с отступами табами, маркированный Markdown-список
            или JSON-документ вида <code>{'{'}"version":1,"root":...{'}'}</code>.
            Косая черта <code>/</code> в конце строки означает папку (для табов/markdown).
            Формат определяется автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenFile}>
            <FolderOpen className="h-3.5 w-3.5" />
            Открыть файл…
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
            Отмена
          </Button>
          <Button onClick={handleImport}>Импорт</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
