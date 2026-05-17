import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useUIStore } from '@/stores';
import { isTauri } from '@/lib/tauri';

/** Status of the updater state machine surfaced to the UI. */
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface UpdaterController {
  status: UpdaterStatus;
  info: UpdateInfo | null;
  /** 0–1, only valid in `downloading` state. */
  progress: number;
  error: string | null;
  /** Manually triggered check (Settings → Check for updates). */
  checkNow(): Promise<void>;
  installNow(): Promise<void>;
  /** Reset to `idle` and forget the dialog state — used by "Later". */
  dismiss(): void;
}

export const UpdaterContext = createContext<UpdaterController | null>(null);

/** Read the singleton updater state from anywhere below `<UpdaterContext.Provider>`. */
export function useUpdaterContext(): UpdaterController {
  const ctx = useContext(UpdaterContext);
  if (!ctx) {
    throw new Error('useUpdaterContext must be used inside <UpdaterContext.Provider>');
  }
  return ctx;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Auto-checks for updates once per launch (throttled to one HTTP call per 24h)
 *  and exposes manual controls for the Settings dialog. Result lives in module
 *  state so multiple consumers (UpdateDialog, SettingsDialog) share it. */
export function useUpdater(): UpdaterController {
  const autoCheck = useUIStore(s => s.autoCheckUpdates);
  const lastCheckAt = useUIStore(s => s.lastUpdateCheckAt);
  const setLastCheckAt = useUIStore(s => s.setLastUpdateCheckAt);
  const setUpdateDialogOpen = useUIStore(s => s.setUpdateDialogOpen);

  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Hold the latest Update handle across re-renders — downloadAndInstall must
  // be called on the same object returned from check().
  const updateRef = useRef<Update | null>(null);
  const totalBytesRef = useRef(0);
  const receivedRef = useRef(0);

  const runCheck = useCallback(
    async (opts: { manual: boolean }) => {
      if (!isTauri()) {
        if (opts.manual) setStatus('unavailable');
        return;
      }
      setStatus('checking');
      setError(null);
      try {
        const update = await check();
        setLastCheckAt(Date.now());
        if (!update) {
          updateRef.current = null;
          setInfo(null);
          setStatus('unavailable');
          if (opts.manual) {
            // Auto-close "no updates" status after a few seconds when invoked
            // manually so the Settings UI feels responsive.
            setTimeout(() => {
              setStatus(s => (s === 'unavailable' ? 'idle' : s));
            }, 4000);
          }
          return;
        }
        updateRef.current = update;
        setInfo({
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        });
        setStatus('available');
        setUpdateDialogOpen(true);
      } catch (e) {
        setStatus('error');
        setError((e as Error).message ?? String(e));
      }
    },
    [setLastCheckAt, setUpdateDialogOpen],
  );

  const installNow = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    setStatus('downloading');
    setProgress(0);
    totalBytesRef.current = 0;
    receivedRef.current = 0;
    setError(null);
    try {
      await update.downloadAndInstall(ev => {
        if (ev.event === 'Started') {
          totalBytesRef.current = ev.data.contentLength ?? 0;
        } else if (ev.event === 'Progress') {
          receivedRef.current += ev.data.chunkLength;
          const total = totalBytesRef.current;
          setProgress(total > 0 ? Math.min(1, receivedRef.current / total) : 0);
        } else if (ev.event === 'Finished') {
          setProgress(1);
        }
      });
      setStatus('ready');
      // Tauri's updater restarts Windows MSI installers automatically via
      // installMode=passive; for the unified UX we relaunch here as well so
      // macOS/Linux behave consistently.
      try {
        await relaunch();
      } catch (e) {
        setError((e as Error).message ?? String(e));
      }
    } catch (e) {
      setStatus('error');
      setError((e as Error).message ?? String(e));
    }
  }, []);

  const dismiss = useCallback(() => {
    setUpdateDialogOpen(false);
    if (status === 'available' || status === 'error' || status === 'unavailable') {
      setStatus('idle');
    }
  }, [setUpdateDialogOpen, status]);

  // One-shot on mount: respect auto-check setting + 24h throttle.
  const checkedOnceRef = useRef(false);
  useEffect(() => {
    if (checkedOnceRef.current) return;
    checkedOnceRef.current = true;
    if (!autoCheck) return;
    const since = Date.now() - lastCheckAt;
    if (lastCheckAt > 0 && since < DAY_MS) return;
    // Delay a few seconds so the splash isn't blocked by network I/O.
    const id = setTimeout(() => {
      void runCheck({ manual: false });
    }, 3500);
    return () => clearTimeout(id);
  }, [autoCheck, lastCheckAt, runCheck]);

  return {
    status,
    info,
    progress,
    error,
    checkNow: () => runCheck({ manual: true }),
    installNow,
    dismiss,
  };
}
