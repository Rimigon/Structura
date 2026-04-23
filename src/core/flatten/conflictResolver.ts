import type { ConflictStrategy } from '@/types';
import { splitExt } from '../tree/paths';

const COUNTER_LIMIT = 10_000;

export function resolveName(
  name: string,
  parentName: string,
  taken: Set<string>,
  strategy: ConflictStrategy,
): string {
  if (strategy === 'overwrite') return name;
  if (strategy === 'skip' && taken.has(name)) return name;

  if (!taken.has(name)) return name;

  if (strategy === 'counter-only') {
    return counterFallback(name, taken);
  }

  const prefixed = parentName ? `${parentName}-${name}` : name;
  if (!taken.has(prefixed)) return prefixed;

  return counterFallback(prefixed, taken);
}

function counterFallback(name: string, taken: Set<string>): string {
  const { base, ext } = splitExt(name);
  for (let n = 2; n < COUNTER_LIMIT; n++) {
    const candidate = `${base}-${n}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`could not resolve name conflict for "${name}" after ${COUNTER_LIMIT} tries`);
}
