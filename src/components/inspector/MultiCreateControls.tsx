import { useState } from 'react';
import { FolderPlus, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSelectionStore, useTreeStore } from '@/stores';

export function MultiCreateControls() {
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const createNode = useTreeStore(s => s.createNode);
  const nodes = useTreeStore(s => s.nodes);
  const [name, setName] = useState('');

  if (multiSelect.size < 2) return null;

  const selectedDirs = Array.from(multiSelect).filter(id => nodes[id]?.kind === 'dir');
  const skipped = multiSelect.size - selectedDirs.length;

  const handleCreate = (kind: 'file' | 'dir') => {
    const finalName = name.trim() || (kind === 'dir' ? 'новая-папка' : 'новый-файл');
    for (const parentId of selectedDirs) {
      createNode(parentId, kind, finalName);
    }
    setName('');
  };

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Массовое создание
      </div>
      <p className="text-xs text-muted-foreground">
        Добавить во все выделенные папки ({selectedDirs.length}).
        {skipped > 0 && ` Файлов будет пропущено: ${skipped}.`}
      </p>
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Имя"
        className="h-8 text-xs font-mono-tight"
      />
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => handleCreate('dir')}
          disabled={selectedDirs.length === 0}
        >
          <FolderPlus className="h-4 w-4" />
          Папка
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => handleCreate('file')}
          disabled={selectedDirs.length === 0}
        >
          <FilePlus className="h-4 w-4" />
          Файл
        </Button>
      </div>
    </div>
  );
}
