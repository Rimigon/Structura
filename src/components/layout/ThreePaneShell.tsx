import type { ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useUIStore } from '@/stores';

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneShell({ left, center, right }: Props) {
  const leftSize = useUIStore(s => s.leftPanelSize);
  const rightSize = useUIStore(s => s.rightPanelSize);
  const setSizes = useUIStore(s => s.setPanelSizes);

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1"
      onLayout={sizes => {
        if (sizes.length === 3) {
          setSizes(sizes[0]!, sizes[2]!);
        }
      }}
    >
      <ResizablePanel defaultSize={leftSize} minSize={12} maxSize={40}>
        {left}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={100 - leftSize - rightSize} minSize={30}>
        {center}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={rightSize} minSize={18} maxSize={45}>
        {right}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
