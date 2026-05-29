import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { FileNode, TreeNode } from '@/types';
import { getThumbnail, isTauri } from '@/lib/tauri';

// Webview can render these directly (asset-protocol fallback if a Rust thumbnail
// fails to produce/render).
const WEBVIEW_IMG = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'jfif',
]);
const WEBVIEW_VIDEO = new Set(['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v']);
const SHELL_MEDIA = new Set([
  'heic', 'heif', 'tif', 'tiff',
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2',
  'avi', 'mkv', 'wmv', 'flv', 'mpg', 'mpeg', '3gp', 'ts', 'm2ts',
]);

export function isMediaExt(ext: string): boolean {
  const e = ext.toLowerCase();
  return WEBVIEW_IMG.has(e) || WEBVIEW_VIDEO.has(e) || SHELL_MEDIA.has(e);
}

export function isMediaNode(node: TreeNode): boolean {
  return (
    node.kind === 'file' &&
    node.dirty !== 'deleted' &&
    !!node.originalPath &&
    isMediaExt((node as FileNode).ext)
  );
}

// Shared cache + bounded concurrency for the Rust thumbnail data URLs.
const CACHE = new Map<string, string>();
const FAILED = new Set<string>();
const CACHE_MAX = 1000;

function remember(key: string, url: string): void {
  CACHE.set(key, url);
  if (CACHE.size > CACHE_MAX) {
    let drop = CACHE.size - CACHE_MAX;
    for (const k of CACHE.keys()) {
      CACHE.delete(k);
      if (--drop <= 0) break;
    }
  }
}

const MAX_CONCURRENT = 6;
let active = 0;
const queue: (() => void)[] = [];

function enqueue(task: () => Promise<void>): void {
  const run = () => {
    active++;
    task().finally(() => {
      active--;
      const next = queue.shift();
      if (next) next();
    });
  };
  if (active < MAX_CONCURRENT) run();
  else queue.push(run);
}

type Stage = 'thumb' | 'asset' | 'icon';

interface Props {
  node: TreeNode;
  /** Thumbnail request size (px) — small for rows/cards, larger for previews. */
  size: number;
  className?: string;
  style?: CSSProperties;
  /** Shown when not media / while loading / on total failure. */
  fallback: ReactNode;
  eager?: boolean;
}

function FileThumbnailInner({ node, size, className, style, fallback }: Props) {
  const file = node.kind === 'file' ? (node as FileNode) : null;
  const path = file?.originalPath ?? '';
  const ext = file ? file.ext.toLowerCase() : '';
  const enabled = isMediaNode(node) && isTauri();
  const key = `${path}|${size}`;
  const canAsset = WEBVIEW_IMG.has(ext) || WEBVIEW_VIDEO.has(ext);
  const isVideo = WEBVIEW_VIDEO.has(ext);

  // Prefer a small Rust thumbnail (bounded memory, fast); fall back to the
  // asset protocol, then to the icon, so previews always resolve to *something*.
  const [thumb, setThumb] = useState<string | null>(() => CACHE.get(key) ?? null);
  const [stage, setStage] = useState<Stage>(() =>
    CACHE.get(key) ? 'thumb' : 'thumb',
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toAsset = () => setStage(canAsset ? 'asset' : 'icon');

  useEffect(() => {
    if (!enabled || !path) return;
    const cached = CACHE.get(key);
    if (cached) {
      setThumb(cached);
      setStage('thumb');
      return;
    }
    setThumb(null);
    setStage('thumb');
    if (FAILED.has(key)) {
      toAsset();
      return;
    }
    let cancelled = false;
    enqueue(async () => {
      if (cancelled) return;
      const hit = CACHE.get(key);
      if (hit) {
        if (!cancelled) {
          setThumb(hit);
          setStage('thumb');
        }
        return;
      }
      try {
        const data = await getThumbnail(path, size);
        remember(key, data);
        if (!cancelled) {
          setThumb(data);
          setStage('thumb');
        }
      } catch {
        FAILED.add(key);
        if (!cancelled) toAsset();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, size, path]);

  // Safety net: if the data-URL <img> neither loads nor errors (rare WebView2
  // silent-blank), escalate to the asset path after a short delay.
  useEffect(() => {
    if (stage !== 'thumb' || !thumb) return;
    timerRef.current = setTimeout(() => toAsset(), 2500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, thumb]);

  if (!enabled || !path) return <>{fallback}</>;

  if (stage === 'thumb' && thumb) {
    return (
      <img
        src={thumb}
        alt={node.name}
        className={className}
        style={style}
        draggable={false}
        decoding="async"
        onLoad={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
        onError={toAsset}
      />
    );
  }

  if (stage === 'asset') {
    if (isVideo) {
      return (
        <video
          src={convertFileSrc(path)}
          className={className}
          style={style}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={e => {
            try {
              e.currentTarget.currentTime = 0.1;
            } catch {
              /* ignore */
            }
          }}
          onError={() => setStage('icon')}
        />
      );
    }
    return (
      <img
        src={convertFileSrc(path)}
        alt={node.name}
        className={className}
        style={style}
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={() => setStage('icon')}
      />
    );
  }

  if (stage === 'icon') return <>{fallback}</>;

  // Rust thumbnail still pending.
  return (
    <span className="flex items-center justify-center" style={style}>
      {fallback}
    </span>
  );
}

export const FileThumbnail = memo(FileThumbnailInner);
