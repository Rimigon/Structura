import { useMemo, useState } from 'react';
import { Download, Save } from 'lucide-react';
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
import { treeToJson, treeToMarkdown, treeToTabIndent } from '@/core/parser';
import type { DirNode, NodeId, TreeNode, TreeState } from '@/types';
import { useSelectionStore, useTreeStore, useUIStore } from '@/stores';
import { isTauri, pickSaveFile, writeTextFile } from '@/lib/tauri';

type ExportFormat = 'tab' | 'markdown' | 'json';

const EXTENSIONS: Record<ExportFormat, { ext: string; filter: string }> = {
  tab: { ext: 'txt', filter: 'Текст' },
  markdown: { ext: 'md', filter: 'Markdown' },
  json: { ext: 'json', filter: 'JSON' },
};

export function ExportDialog() {
  const open = useUIStore(s => s.exportDialogOpen);
  const setOpen = useUIStore(s => s.setExportDialogOpen);
  const [format, setFormat] = useState<ExportFormat>('tab');
  const rootId = useTreeStore(s => s.rootId);
  const nodes = useTreeStore(s => s.nodes);
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const multiSelect = useSelectionStore(s => s.multiSelect);

  const [exportRootId, setExportRootId] = useState<NodeId | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allDirs = useMemo(() => {
    if (!rootId) return [] as { id: NodeId; label: string; depth: number }[];
    const list: { id: NodeId; label: string; depth: number }[] = [];
    const walk = (id: NodeId, depth: number) => {
      const n = nodes[id];
      if (!n || n.kind !== 'dir') return;
      list.push({ id, label: n.name, depth });
      for (const cid of (n as DirNode).childIds) {
        const c = nodes[cid];
        if (c?.kind === 'dir') walk(cid, depth + 1);
      }
    };
    walk(rootId, 0);
    return list;
  }, [nodes, rootId]);

  const effectiveRoot = exportRootId ?? rootId;

  const state = useMemo<TreeState>(() => {
    if (!effectiveRoot) return { rootId: null, nodes: {}, rootFsPath };
    if (!onlySelected || multiSelect.size === 0) {
      return { rootId: effectiveRoot, nodes, rootFsPath };
    }
    const keep = new Set<NodeId>();
    for (const id of multiSelect) {
      let cur: NodeId | null = id;
      while (cur) {
        keep.add(cur);
        cur = nodes[cur]?.parentId ?? null;
      }
      const n = nodes[id];
      if (n?.kind === 'dir') addDescendants(nodes, id, keep);
    }
    const filtered: Record<NodeId, TreeNode> = {};
    for (const id of keep) {
      const n = nodes[id];
      if (!n) continue;
      if (n.kind === 'dir') {
        filtered[id] = {
          ...n,
          childIds: (n as DirNode).childIds.filter(cid => keep.has(cid)),
        };
      } else {
        filtered[id] = n;
      }
    }
    return { rootId: effectiveRoot, nodes: filtered, rootFsPath };
  }, [effectiveRoot, nodes, rootFsPath, onlySelected, multiSelect]);

  const text = useMemo(() => {
    if (format === 'json') return treeToJson(state);
    if (format === 'markdown') return treeToMarkdown(state);
    return treeToTabIndent(state);
  }, [format, state]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaved(null);
    try {
      const { ext, filter } = EXTENSIONS[format];
      const rootName =
        (effectiveRoot ? nodes[effectiveRoot]?.name : 'tree') ?? 'tree';
      const suggested = `${rootName}.${ext}`;
      if (!isTauri()) {
        setError('Сохранение в файл доступно только в приложении Tauri.');
        return;
      }
      const path = await pickSaveFile(suggested, filter, [ext]);
      if (!path) return;
      await writeTextFile(path, text);
      setSaved(path);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Экспорт дерева в текст</DialogTitle>
          <DialogDescription>
            Выберите корневую папку, формат и способ вывода — в буфер или в файл.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Корневая папка</label>
            <select
              value={effectiveRoot ?? ''}
              onChange={e => setExportRootId(e.target.value || null)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono-tight"
            >
              {allDirs.map(d => (
                <option key={d.id} value={d.id}>
                  {'  '.repeat(d.depth)}
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Формат</label>
            <div className="flex gap-1">
              <Button
                variant={format === 'tab' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('tab')}
              >
                Табы
              </Button>
              <Button
                variant={format === 'markdown' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('markdown')}
              >
                Markdown
              </Button>
              <Button
                variant={format === 'json' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('json')}
              >
                JSON
              </Button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={e => setOnlySelected(e.target.checked)}
            disabled={multiSelect.size === 0}
          />
          Только выделенные ({multiSelect.size})
        </label>

        <Textarea
          value={text}
          readOnly
          className="font-mono-tight min-h-[240px]"
          spellCheck={false}
        />

        {saved && (
          <div className="rounded-md border border-border bg-card/60 p-2 text-xs font-mono-tight text-muted-foreground">
            Сохранено: {saved}
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            <Download className="h-3.5 w-3.5" />
            Копировать
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Сохранить в файл…
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function addDescendants(
  nodes: Record<NodeId, TreeNode>,
  id: NodeId,
  out: Set<NodeId>,
): void {
  const n = nodes[id];
  if (!n) return;
  out.add(id);
  if (n.kind === 'dir') {
    for (const cid of (n as DirNode).childIds) addDescendants(nodes, cid, out);
  }
}
