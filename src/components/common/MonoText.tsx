import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function MonoText({ className, children, ...rest }: Props) {
  return (
    <span
      className={cn('font-mono-tight text-sm tabular-nums', className)}
      {...rest}
    >
      {children}
    </span>
  );
}
