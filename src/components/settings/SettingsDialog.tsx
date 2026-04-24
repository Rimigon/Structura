import { useEffect, useState } from 'react';
import { Check, Cog, Loader2, Terminal, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import {
  installShellIntegration,
  isTauri,
  shellIntegrationStatus,
  uninstallShellIntegration,
  type ShellIntegrationStatus,
} from '@/lib/tauri';

export function SettingsDialog() {
  const open = useUIStore(s => s.settingsDialogOpen);
  const setOpen = useUIStore(s => s.setSettingsDialogOpen);
  const [status, setStatus] = useState<ShellIntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    if (!isTauri()) return;
    try {
      const s = await shellIntegrationStatus();
      setStatus(s);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    }
  };

  useEffect(() => {
    if (open) reload();
  }, [open]);

  const handleInstall = async () => {
    setBusy(true);
    setErr(null);
    try {
      await installShellIntegration();
      await reload();
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async () => {
    setBusy(true);
    setErr(null);
    try {
      await uninstallShellIntegration();
      await reload();
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5 text-primary" />
            Настройки
          </DialogTitle>
          <DialogDescription>
            Интеграция Structura с операционной системой и сопутствующие опции.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-medium">Контекстное меню Windows</span>
              {status && status.installed && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-diff-added">
                  <Check className="h-3 w-3" />
                  установлено
                </span>
              )}
              {status && !status.installed && status.supported && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                  <X className="h-3 w-3" />
                  не установлено
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              {status?.note ?? 'Загрузка…'}
            </p>
            {status?.supported && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall} disabled={busy || status.installed}>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Установить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUninstall}
                  disabled={busy || !status.installed}
                >
                  <X className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              </div>
            )}
            {status && !status.supported && (
              <p className="text-[11px] italic text-muted-foreground">
                Платформа: {status.platform}. Поддержка других ОС в планах.
              </p>
            )}
          </div>

          {err && (
            <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive break-words">
              {err}
              {err.toLowerCase().includes('permission') && (
                <div className="mt-1 text-[11px]">
                  Совет: запустите Structura от имени администратора.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
