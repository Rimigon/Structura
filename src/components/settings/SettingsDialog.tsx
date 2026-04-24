import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Cog,
  Globe,
  Keyboard,
  Loader2,
  RotateCcw,
  Terminal,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores';
import {
  captureHotkey,
  DEFAULT_HOTKEYS,
  formatHotkey,
  HOTKEY_ACTIONS,
  type HotkeyAction,
  type HotkeySpec,
} from '@/stores/uiStore';
import { LOCALES, useT } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
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
  const locale = useUIStore(s => s.locale);
  const setLocale = useUIStore(s => s.setLocale);
  const hotkeys = useUIStore(s => s.hotkeys);
  const setHotkey = useUIStore(s => s.setHotkey);
  const resetHotkeys = useUIStore(s => s.resetHotkeys);
  const setHelpDialogOpen = useUIStore(s => s.setHelpDialogOpen);
  const t = useT();
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5 text-primary" />
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription>{t('settings.subtitle')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[560px] pr-3 scrollbar-thin">
          <div className="space-y-4">
            {/* Language ---------------------------------------------------- */}
            <Section icon={Globe} title={t('settings.language')}>
              <p className="text-xs text-muted-foreground mb-2">
                {t('settings.languageHint')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {LOCALES.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLocale(l.id as Locale)}
                    className={
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ' +
                      (locale === l.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/60')
                    }
                  >
                    <span className="font-mono-tight font-semibold">{l.flag}</span>
                    <span>{l.label}</span>
                    {locale === l.id && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </Section>

            {/* Hotkeys ----------------------------------------------------- */}
            <Section icon={Keyboard} title={t('settings.hotkeys')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-muted-foreground">
                  {t('settings.hotkeysHint')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetHotkeys}
                  className="h-7 shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('settings.hotkeysReset')}
                </Button>
              </div>
              <div className="space-y-1">
                {HOTKEY_ACTIONS.map(action => (
                  <HotkeyRow
                    key={action}
                    action={action}
                    spec={hotkeys[action]}
                    onChange={spec => setHotkey(action, spec)}
                  />
                ))}
              </div>
            </Section>

            {/* Shell integration ----------------------------------------- */}
            <Section icon={Terminal} title={t('settings.shell')}>
              <div className="flex items-center gap-2">
                {status && status.installed && (
                  <span className="flex items-center gap-1 text-[11px] text-diff-added">
                    <Check className="h-3 w-3" />
                    {t('settings.shellInstalled')}
                  </span>
                )}
                {status && !status.installed && status.supported && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <X className="h-3 w-3" />
                    {t('settings.shellNotInstalled')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-snug my-2">
                {status?.note ?? t('common.loading')}
              </p>
              {status?.supported && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    disabled={busy || status.installed}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {t('common.install')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUninstall}
                    disabled={busy || !status.installed}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('common.uninstall')}
                  </Button>
                </div>
              )}
              {status && !status.supported && (
                <p className="text-[11px] italic text-muted-foreground">
                  {t('settings.shellPlatform')}: {status.platform}.{' '}
                  {t('settings.shellOther')}
                </p>
              )}
              {err && (
                <div className="rounded-md border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive break-words mt-2">
                  {err}
                  {err.toLowerCase().includes('permission') && (
                    <div className="mt-1 text-[11px]">{t('settings.adminHint')}</div>
                  )}
                </div>
              )}
            </Section>

            {/* Help -------------------------------------------------------- */}
            <Section icon={BookOpen} title={t('help.title')}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setHelpDialogOpen(true);
                }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('settings.help')}
              </Button>
            </Section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cog;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-1">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function HotkeyRow({
  action,
  spec,
  onChange,
}: {
  action: HotkeyAction;
  spec: HotkeySpec;
  onChange: (spec: HotkeySpec) => void;
}) {
  const t = useT();
  const [capturing, setCapturing] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setCapturing(false);
      return;
    }
    if (e.key === 'Delete') {
      onChange({ ...DEFAULT_HOTKEYS[action] });
      setCapturing(false);
      return;
    }
    const captured = captureHotkey(e.nativeEvent);
    if (!captured) return;
    onChange(captured);
    setCapturing(false);
  };

  const isDefault =
    JSON.stringify(spec) === JSON.stringify(DEFAULT_HOTKEYS[action]);

  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1">
      <span className="text-xs text-foreground/90">{t(`hk.${action}`)}</span>
      <button
        ref={ref}
        type="button"
        onClick={() => {
          setCapturing(true);
          setTimeout(() => ref.current?.focus(), 0);
        }}
        onBlur={() => setCapturing(false)}
        onKeyDown={capturing ? handleKeyDown : undefined}
        className={
          'min-w-[110px] rounded border px-2 py-0.5 font-mono-tight text-[11px] transition-colors ' +
          (capturing
            ? 'border-primary bg-primary/10 text-foreground animate-pulse'
            : isDefault
              ? 'border-border bg-muted text-muted-foreground'
              : 'border-primary/60 bg-primary/5 text-foreground')
        }
      >
        {capturing ? '…' : formatHotkey(spec)}
      </button>
    </div>
  );
}
