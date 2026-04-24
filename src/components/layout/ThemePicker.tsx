import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { THEMES, useUIStore, type ThemeId } from '@/stores/uiStore';

export function ThemePicker() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 220;
    const x = Math.max(4, Math.min(window.innerWidth - menuW - 4, rect.right - menuW));
    const y = rect.bottom + 4;
    setPos({ x, y });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current && !menuRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      const t = e.target as Node | null;
      if (t && menuRef.current && (t === menuRef.current || menuRef.current.contains(t))) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const handlePick = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
  };

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="neumorphic fixed min-w-[220px] max-h-[60vh] overflow-y-auto scrollbar-thin rounded-md border border-border py-1 shadow-xl"
            style={{ left: pos.x, top: pos.y, zIndex: 9999 }}
          >
            {THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.id}
                onClick={() => handlePick(t.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-mono-tight hover:bg-accent"
              >
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center shrink-0">
                  {theme === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                <span>{t.label}</span>
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                  {t.dark ? 'dark' : 'light'}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        ref={btnRef}
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Тема оформления"
        title="Тема оформления"
        onClick={() => setOpen(v => !v)}
      >
        <Palette className="h-3.5 w-3.5" />
      </Button>
      {menu}
    </>
  );
}
