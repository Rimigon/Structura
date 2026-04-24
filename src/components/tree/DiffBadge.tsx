import type { DirtyFlag } from '@/types';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';

const LABEL: Record<DirtyFlag, string> = {
  new: '+',
  moved: 'M',
  renamed: 'R',
  deleted: '×',
};

const COLOR: Record<DirtyFlag, string> = {
  new: 'text-diff-added border-diff-added',
  moved: 'text-diff-moved border-diff-moved',
  renamed: 'text-diff-renamed border-diff-renamed',
  deleted: 'text-diff-removed border-diff-removed',
};

interface Props {
  dirty?: DirtyFlag;
}

export function DiffBadge({ dirty }: Props) {
  const t = useT();
  if (!dirty) return null;
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm border px-1 text-[10px] font-semibold leading-none',
        COLOR[dirty],
      )}
      title={t(`nd.dirty.${dirty}`)}
    >
      {LABEL[dirty]}
    </span>
  );
}
