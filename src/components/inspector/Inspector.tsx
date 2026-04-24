import { useSelectionStore, useTreeStore } from '@/stores';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlassPanel } from '@/components/common/GlassPanel';
import { useT } from '@/lib/i18n';
import { NodeDetails } from './NodeDetails';
import { FlattenControls } from './FlattenControls';
import { MultiCreateControls } from './MultiCreateControls';

export function Inspector() {
  const focusedId = useSelectionStore(s => s.focusedId);
  const multiSelect = useSelectionStore(s => s.multiSelect);
  const node = useTreeStore(s => (focusedId ? s.nodes[focusedId] : null));
  const multiMode = multiSelect.size > 1;
  const t = useT();

  return (
    <GlassPanel className="border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {multiMode
            ? `${t('inspector.selectedN')}: ${multiSelect.size}`
            : t('inspector.properties')}
        </span>
      </div>
      <ScrollArea className="h-full px-3 py-3 scrollbar-thin">
        {multiMode ? (
          <MultiCreateControls />
        ) : node ? (
          <div className="space-y-4">
            <NodeDetails node={node} />
            {node.kind === 'dir' && <FlattenControls targetId={node.id} />}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">{t('inspector.chooseOne')}</div>
        )}
      </ScrollArea>
    </GlassPanel>
  );
}
