import { useMemo } from 'react';
import type { DirNode, TreeNode } from '@/types';
import { MonoText } from '@/components/common/MonoText';
import { useTreeStore } from '@/stores';

interface Props {
  node: TreeNode;
}

function humanSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

const KIND_RU: Record<TreeNode['kind'], string> = {
  file: 'файл',
  dir: 'папка',
};

const DIRTY_RU: Record<NonNullable<TreeNode['dirty']>, string> = {
  new: 'новый',
  moved: 'перемещён',
  renamed: 'переименован',
  deleted: 'удалён',
};

export function NodeDetails({ node }: Props) {
  const nodes = useTreeStore(s => s.nodes);

  const stats = useMemo(() => {
    if (node.kind !== 'dir') return null;
    let files = 0;
    let dirs = 0;
    let total = 0;
    const visit = (id: string) => {
      const n = nodes[id];
      if (!n || n.dirty === 'deleted') return;
      if (n.kind === 'dir') {
        if (n.id !== node.id) dirs++;
        for (const cid of (n as DirNode).childIds) visit(cid);
      } else {
        files++;
        total += n.size;
      }
    };
    visit(node.id);
    const direct = (node as DirNode).childIds.filter(cid => {
      const n = nodes[cid];
      return n && n.dirty !== 'deleted';
    }).length;
    return { files, dirs, total, direct };
  }, [node, nodes]);

  return (
    <div className="space-y-3 text-sm">
      <Field label="Имя">
        <MonoText>{node.name}</MonoText>
      </Field>
      <Field label="Тип">{KIND_RU[node.kind]}</Field>
      {node.kind === 'file' && (
        <>
          <Field label="Размер">{humanSize(node.size)}</Field>
          {node.ext && <Field label="Расширение">.{node.ext}</Field>}
          {node.modified > 0 && (
            <Field label="Изменён">
              {new Date(node.modified).toLocaleString('ru-RU')}
            </Field>
          )}
        </>
      )}
      {stats && (
        <>
          <Field label="Содержимое">
            <div className="font-mono-tight text-xs text-muted-foreground">
              непосредственно: {stats.direct}
            </div>
            <div className="font-mono-tight text-xs text-muted-foreground">
              всего файлов: {stats.files}
            </div>
            <div className="font-mono-tight text-xs text-muted-foreground">
              всего папок: {stats.dirs}
            </div>
          </Field>
          <Field label="Суммарный размер">{humanSize(stats.total)}</Field>
        </>
      )}
      {node.originalPath && (
        <Field label="Путь">
          <MonoText className="break-all text-xs">{node.originalPath}</MonoText>
        </Field>
      )}
      {node.dirty && <Field label="Статус">{DIRTY_RU[node.dirty]}</Field>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
