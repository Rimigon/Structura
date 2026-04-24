import { useEffect, useState } from 'react';
import { Download, FileStack } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { closeFloatingWidget, isTauri } from '@/lib/tauri';

export function FloatingWidget() {
  const [hover, setHover] = useState(false);
  const [dropped, setDropped] = useState<string[]>([]);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWebviewWindow();
    let unlisten: (() => void) | null = null;
    win
      .onDragDropEvent(async ev => {
        if (ev.payload.type === 'over') setHover(true);
        else if (ev.payload.type === 'drop') {
          setHover(false);
          const paths = ev.payload.paths;
          setDropped(prev => [...paths, ...prev].slice(0, 6));
          // Emit to main window so it can process the drop
          await win.emit('widget-dropped', paths);
        } else if (ev.payload.type === 'leave') {
          setHover(false);
        }
      })
      .then(fn => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-xs font-mono-tight"
      style={{
        background: hover
          ? 'radial-gradient(circle, hsl(var(--primary) / 0.5), hsl(var(--background) / 0.95))'
          : 'radial-gradient(circle, hsl(var(--card) / 0.9), hsl(var(--background) / 0.8))',
        border: '1px solid hsl(var(--border))',
        cursor: 'grab',
      }}
      onDoubleClick={() => {
        closeFloatingWidget().catch(() => void 0);
      }}
      data-tauri-drag-region
    >
      <FileStack className="h-6 w-6 text-primary" data-tauri-drag-region />
      <div className="text-[11px] text-muted-foreground" data-tauri-drag-region>
        {hover ? 'Отпусти файлы' : 'Перетащи сюда'}
      </div>
      {dropped.length > 0 && (
        <div className="w-full space-y-0.5 overflow-hidden">
          {dropped.slice(0, 3).map((p, i) => (
            <div
              key={i}
              className="truncate text-[10px] text-foreground"
              title={p}
            >
              <Download className="mr-1 inline h-2.5 w-2.5" />
              {p.split(/[\\/]/).pop()}
            </div>
          ))}
          {dropped.length > 3 && (
            <div className="text-[10px] text-muted-foreground">
              +{dropped.length - 3} ещё
            </div>
          )}
        </div>
      )}
      <div
        className="text-[9px] text-muted-foreground/70"
        data-tauri-drag-region
      >
        2× клик — закрыть
      </div>
    </div>
  );
}
