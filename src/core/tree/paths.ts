export function joinPath(...parts: string[]): string {
  const nonEmpty = parts.filter(p => p.length > 0);
  if (nonEmpty.length === 0) return '';
  let result = nonEmpty[0]!;
  for (let i = 1; i < nonEmpty.length; i++) {
    const next = nonEmpty[i]!;
    if (result.endsWith('/') || result.endsWith('\\')) {
      result += next;
    } else {
      const sep = looksLikeWindows(result) ? '\\' : '/';
      result += sep + next;
    }
  }
  return result;
}

export function dirname(p: string): string {
  const idx = lastSepIndex(p);
  if (idx < 0) return '';
  if (idx === 0) return p.slice(0, 1);
  return p.slice(0, idx);
}

export function basename(p: string): string {
  const idx = lastSepIndex(p);
  return idx < 0 ? p : p.slice(idx + 1);
}

export function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    return { base: name, ext: '' };
  }
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

export function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function lastSepIndex(p: string): number {
  const fwd = p.lastIndexOf('/');
  const back = p.lastIndexOf('\\');
  return Math.max(fwd, back);
}

function looksLikeWindows(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.includes('\\');
}

export function isValidName(name: string): boolean {
  if (name.length === 0) return false;
  if (name === '.' || name === '..') return false;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false;
  return true;
}
