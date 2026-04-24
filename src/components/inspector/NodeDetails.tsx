import { useEffect, useMemo, useState } from 'react';
import type { DirNode, TreeNode } from '@/types';
import { MonoText } from '@/components/common/MonoText';
import { useTreeStore } from '@/stores';
import { extractMetadata, isTauri, type MediaMetadata } from '@/lib/tauri';

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

const MEDIA_EXTS = new Set([
  'jpg', 'jpeg', 'tiff', 'tif', 'heic', 'heif', 'webp', 'png',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff',
]);

export function NodeDetails({ node }: Props) {
  const nodes = useTreeStore(s => s.nodes);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri() || node.kind !== 'file' || !node.originalPath) {
      setMetadata(null);
      setMetaError(null);
      return;
    }
    if (!MEDIA_EXTS.has(node.ext.toLowerCase())) {
      setMetadata(null);
      setMetaError(null);
      return;
    }
    let cancelled = false;
    extractMetadata(node.originalPath)
      .then(m => {
        if (!cancelled) {
          setMetadata(m);
          setMetaError(null);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setMetadata(null);
          setMetaError((e as Error).message ?? String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [node]);

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
      {metadata && hasAnyMeta(metadata) && (
        <Field label="Метаданные">
          <div className="font-mono-tight text-xs space-y-0.5">
            {metadata.exifDate && <div>📅 {metadata.exifDate}</div>}
            {metadata.exifCamera && <div>📷 {metadata.exifCamera}</div>}
            {metadata.exifLens && <div>🔭 {metadata.exifLens}</div>}
            {(metadata.exifWidth || metadata.exifHeight) && (
              <div>
                📐 {metadata.exifWidth ?? '?'} × {metadata.exifHeight ?? '?'}
              </div>
            )}
            {metadata.id3Artist && <div>🎤 {metadata.id3Artist}</div>}
            {metadata.id3Title && <div>🎵 {metadata.id3Title}</div>}
            {metadata.id3Album && <div>💿 {metadata.id3Album}</div>}
            {metadata.id3Year && <div>🗓 {metadata.id3Year}</div>}
            {metadata.id3Track && <div>#{metadata.id3Track}</div>}
          </div>
        </Field>
      )}
      {metaError && (
        <div className="text-[11px] text-muted-foreground italic">
          Метаданные недоступны
        </div>
      )}
    </div>
  );
}

function hasAnyMeta(m: MediaMetadata): boolean {
  return !!(
    m.exifDate ||
    m.exifCamera ||
    m.exifLens ||
    m.exifWidth ||
    m.exifHeight ||
    m.id3Artist ||
    m.id3Title ||
    m.id3Album ||
    m.id3Year ||
    m.id3Track
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
