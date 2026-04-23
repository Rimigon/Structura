import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassPanel({ className, children, ...rest }: Props) {
  return (
    <div className={cn('glass h-full w-full overflow-hidden', className)} {...rest}>
      {children}
    </div>
  );
}
