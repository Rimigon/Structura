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
  const leftVisible = useUIStore(s => s.leftPanelVisible);
  const rightVisible = useUIStore(s => s.rightPanelVisible);
  const setSizes = useUIStore(s => s.setPanelSizes);

  const centerSize = Math.max(
    30,
    100 - (leftVisible ? leftSize : 0) - (rightVisible ? rightSize : 0),
  );

  return (
    <ResizablePanelGroup
      // Remount the panel group when visibility changes so that defaultSize
      // values are reapplied (react-resizable-panels otherwise tries to keep
      // the previous layout and the central panel doesn't expand).
      key={`${leftVisible ? 'L' : '-'}${rightVisible ? 'R' : '-'}`}
      direction="horizontal"
      className="flex-1"
      onLayout={sizes => {
        if (leftVisible && rightVisible && sizes.length === 3) {
          setSizes(sizes[0]!, sizes[2]!);
        } else if (leftVisible && !rightVisible && sizes.length === 2) {
          setSizes(sizes[0]!, rightSize);
        } else if (!leftVisible && rightVisible && sizes.length === 2) {
          setSizes(leftSize, sizes[1]!);
        }
      }}
    >
      {leftVisible && (
        <>
          <ResizablePanel defaultSize={leftSize} minSize={12} maxSize={40}>
            {left}
          </ResizablePanel>
          <ResizableHandle />
        </>
      )}
      <ResizablePanel defaultSize={centerSize} minSize={30}>
        {center}
      </ResizablePanel>
      {rightVisible && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={rightSize} minSize={18} maxSize={45}>
            {right}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
