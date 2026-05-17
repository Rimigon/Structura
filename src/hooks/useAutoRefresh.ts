import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  isTauri,
  subscribeWatch,
  unsubscribeWatch,
  type WatchEventPayload,
} from '@/lib/tauri';
import {
  restoreExpanded,
  snapshotExpanded,
  useTreeStore,
  useUIStore,
} from '@/stores';
import { hasPendingChanges } from '@/core/tree/traverse';
import { useT } from '@/lib/i18n';

const DEBOUNCE_MS = 500;
// Suppress watch events that fire as a consequence of our own apply_transaction
// + scanRoot round-trip. Without a cooldown the auto-merge would loop forever.
const SELF_SCAN_COOLDOWN_MS = 2000;

/** Subscribes to the root folder so external file additions/removals (e.g. via
 *  Windows Explorer) are silently re-scanned into the virtual tree. When the
 *  user has unsaved sandbox edits the auto-merge is skipped and a soft warning
 *  is surfaced instead so dirty changes are never trampled. */
export function useAutoRefresh() {
  const rootFsPath = useTreeStore(s => s.rootFsPath);
  const t = useT();
  const watchIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanAtRef = useRef<number>(0);
  // Hold the latest translator in a ref so the global listen() callback isn't
  // recreated every render (Tauri's listen handle is async, leaking is costly).
  const tRef = useRef(t);
  tRef.current = t;

  // (Re)subscribe whenever the active root changes.
  useEffect(() => {
    if (!isTauri() || !rootFsPath) {
      if (watchIdRef.current) {
        const old = watchIdRef.current;
        watchIdRef.current = null;
        unsubscribeWatch(old).catch(() => void 0);
      }
      return;
    }
    let cancelled = false;
    let myId: string | null = null;
    lastScanAtRef.current = Date.now();
    subscribeWatch(rootFsPath, true)
      .then(id => {
        if (cancelled) {
          unsubscribeWatch(id).catch(() => void 0);
          return;
        }
        myId = id;
        watchIdRef.current = id;
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
      if (myId) {
        const old = myId;
        watchIdRef.current = null;
        unsubscribeWatch(old).catch(() => void 0);
      }
    };
  }, [rootFsPath]);

  // One persistent listener; routes events by current watchIdRef.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    listen<WatchEventPayload>('watch-event', ev => {
      const payload = ev.payload;
      if (!payload || payload.watchId !== watchIdRef.current) return;
      if (Date.now() - lastScanAtRef.current < SELF_SCAN_COOLDOWN_MS) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const state = useTreeStore.getState();
        const root = state.rootFsPath;
        if (!root) return;
        if (hasPendingChanges(state)) {
          useUIStore
            .getState()
            .pushNotification(tRef.current('status.diskChangedWithDirty'), 'warn');
          return;
        }
        const snap = snapshotExpanded(state);
        lastScanAtRef.current = Date.now();
        state
          .scanRoot(root)
          .then(() => {
            restoreExpanded(snap);
            lastScanAtRef.current = Date.now();
            useUIStore
              .getState()
              .pushNotification(tRef.current('status.diskChangedToast'), 'info');
          })
          .catch(() => void 0);
      }, DEBOUNCE_MS);
    })
      .then(fn => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => void 0);
    return () => {
      disposed = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (unlisten) unlisten();
    };
  }, []);
}
