import { AlertTriangle, CheckCircle2, Download, Loader2, RocketIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores';
import { useT } from '@/lib/i18n';
import { useUpdaterContext } from '@/hooks/useUpdater';

export function UpdateDialog() {
  const open = useUIStore(s => s.updateDialogOpen);
  const setOpen = useUIStore(s => s.setUpdateDialogOpen);
  const t = useT();
  const { status, info, progress, error, installNow, dismiss } = useUpdaterContext();

  const downloading = status === 'downloading';
  const ready = status === 'ready';
  const errored = status === 'error';
  const percent = Math.round(progress * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v && !downloading) {
          dismiss();
        } else {
          setOpen(v);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {errored ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : ready ? (
              <CheckCircle2 className="h-5 w-5 text-diff-added" />
            ) : (
              <RocketIcon className="h-5 w-5 text-primary" />
            )}
            {errored
              ? t('updater.errorTitle')
              : ready
                ? t('updater.readyTitle')
                : t('updater.availableTitle', { version: info?.version ?? '' })}
          </DialogTitle>
          <DialogDescription>
            {errored
              ? t('updater.errorDesc')
              : ready
                ? t('updater.readyDesc')
                : t('updater.availableDesc')}
          </DialogDescription>
        </DialogHeader>

        {info?.body && !errored && (
          <ScrollArea className="max-h-[240px] rounded-md border border-border bg-card/40 p-3 scrollbar-thin">
            <pre className="whitespace-pre-wrap font-mono-tight text-[11px] leading-snug">
              {info.body}
            </pre>
          </ScrollArea>
        )}

        {downloading && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono-tight text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('updater.downloadingHint', { percent })}
            </div>
          </div>
        )}

        {errored && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive break-words">
            {error ?? t('common.error')}
          </div>
        )}

        <DialogFooter>
          {downloading ? (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('updater.downloading')}
            </Button>
          ) : ready ? (
            <Button disabled>
              <CheckCircle2 className="h-4 w-4" />
              {t('updater.restarting')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={dismiss} disabled={downloading}>
                {t('updater.later')}
              </Button>
              <Button onClick={installNow} disabled={errored || !info}>
                <Download className="h-4 w-4" />
                {t('updater.installNow')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
