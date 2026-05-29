import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DirNode, TreeNode } from '@/types';
import { MonoText } from '@/components/common/MonoText';
import { FileThumbnail, isMediaNode } from '@/components/tree/FileThumbnail';
import { useTreeStore } from '@/stores';
import { useLocale, useT } from '@/lib/i18n';
import { extractMetadata, isTauri, readTextFile, type MediaMetadata } from '@/lib/tauri';

const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv',
  'json', 'jsonc', 'xml', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'css', 'scss', 'less', 'html', 'htm', 'vue', 'svelte',
  'py', 'rs', 'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'rb', 'php', 'swift',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'sql', 'gradle', 'dockerfile', 'gitignore', 'lua', 'r',
]);
const TEXT_PREVIEW_MAX_BYTES = 256 * 1024;
const TEXT_PREVIEW_CHARS = 6000;

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

const MEDIA_EXTS = new Set([
  'jpg', 'jpeg', 'tiff', 'tif', 'heic', 'heif', 'webp', 'png',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff',
]);

export function NodeDetails({ node }: Props) {
  const nodes = useTreeStore(s => s.nodes);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();

  const ext = node.kind === 'file' ? node.ext.toLowerCase() : '';
  const isMedia = isMediaNode(node);
  const isPdf =
    node.kind === 'file' && !!node.originalPath && ext === 'pdf';
  const isText =
    node.kind === 'file' &&
    !!node.originalPath &&
    !isMedia &&
    TEXT_EXTS.has(ext) &&
    node.size > 0 &&
    node.size <= TEXT_PREVIEW_MAX_BYTES;

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

  // Text-file preview — read a capped prefix of the file's content.
  useEffect(() => {
    if (!isText || !isTauri() || node.kind !== 'file' || !node.originalPath) {
      setTextPreview(null);
      return;
    }
    let cancelled = false;
    readTextFile(node.originalPath)
      .then(txt => {
        if (!cancelled) setTextPreview(txt.slice(0, TEXT_PREVIEW_CHARS));
      })
      .catch(() => {
        if (!cancelled) setTextPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isText, node]);

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
      {isMedia && (
        <div className="flex justify-center rounded-md border border-border bg-muted/30 p-2">
          <FileThumbnail
            node={node}
            size={320}
            eager
            className="max-h-56 w-auto rounded object-contain"
            fallback={null}
          />
        </div>
      )}
      {isPdf && node.kind === 'file' && node.originalPath && (
        <iframe
          title={node.name}
          src={convertFileSrc(node.originalPath)}
          className="h-64 w-full rounded-md border border-border bg-white"
        />
      )}
      {isText && textPreview != null && (
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-[10px] leading-snug whitespace-pre-wrap break-words font-mono-tight scrollbar-thin">
          {textPreview}
        </pre>
      )}
      <Field label={t('nd.name')}>
        <MonoText>{node.name}</MonoText>
      </Field>
      <Field label={t('nd.type')}>{t(`nd.kind.${node.kind}`)}</Field>
      {node.kind === 'file' && (
        <>
          <Field label={t('nd.size')}>{humanSize(node.size)}</Field>
          {node.ext && <Field label={t('nd.ext')}>.{node.ext}</Field>}
          {node.modified > 0 && (
            <Field label={t('nd.modified')}>
              {new Date(node.modified).toLocaleString(
                locale === 'ru' ? 'ru-RU' : 'en-US',
              )}
            </Field>
          )}
        </>
      )}
      {stats && (
        <>
          <Field label={t('nd.contents')}>
            <div className="font-mono-tight text-xs text-muted-foreground">
              {t('nd.direct')}: {stats.direct}
            </div>
            <div className="font-mono-tight text-xs text-muted-foreground">
              {t('nd.totalFiles')}: {stats.files}
            </div>
            <div className="font-mono-tight text-xs text-muted-foreground">
              {t('nd.totalDirs')}: {stats.dirs}
            </div>
          </Field>
          <Field label={t('nd.totalSize')}>{humanSize(stats.total)}</Field>
        </>
      )}
      {node.originalPath && (
        <Field label={t('nd.path')}>
          <MonoText className="break-all text-xs">{node.originalPath}</MonoText>
        </Field>
      )}
      {node.dirty && (
        <Field label={t('nd.status')}>{t(`nd.dirty.${node.dirty}`)}</Field>
      )}
      {metadata && hasAnyMeta(metadata) && (
        <Field label={t('nd.metadata')}>
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
          {t('nd.metaUnavailable')}
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
