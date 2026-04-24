import { useState } from 'react';
import { FolderPlus, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSelectionStore, useTreeStore } from '@/stores';
import { defaultNodeName, useT } from '@/lib/i18n';

export function MultiCreateControls() {
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const createNode = useTreeStore(s => s.createNode);
  const nodes = useTreeStore(s => s.nodes);
  const [name, setName] = useState('');
  const t = useT();

  if (multiSelect.size < 2) return null;

  const selectedDirs = Array.from(multiSelect).filter(id => nodes[id]?.kind === 'dir');
  const skipped = multiSelect.size - selectedDirs.length;

  const handleCreate = (kind: 'file' | 'dir') => {
    const finalName = name.trim() || defaultNodeName(kind);
    for (const parentId of selectedDirs) {
      createNode(parentId, kind, finalName);
    }
    setName('');
  };

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('multiCreate.header')}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('multiCreate.addToAll')} ({selectedDirs.length}).
        {skipped > 0 && ` ${t('multiCreate.skippedFiles')}: ${skipped}.`}
      </p>
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('multiCreate.namePlaceholder')}
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
          {t('multiCreate.folder')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => handleCreate('file')}
          disabled={selectedDirs.length === 0}
        >
          <FilePlus className="h-4 w-4" />
          {t('multiCreate.file')}
        </Button>
      </div>
    </div>
  );
}
