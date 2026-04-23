import { describe, expect, it } from 'vitest';
import { detectFormat } from '@/core/parser/detect';

describe('detectFormat', () => {
  it('detects markdown when most lines start with bullets', () => {
    const text = ['- a', '  - b', '  - c'].join('\n');
    expect(detectFormat(text)).toBe('markdown');
  });

  it('detects tab-indent otherwise', () => {
    const text = ['proj/', '\tmain.ts'].join('\n');
    expect(detectFormat(text)).toBe('tab');
  });

  it('handles empty input', () => {
    expect(detectFormat('')).toBe('tab');
  });

  it('detects json by leading brace', () => {
    expect(detectFormat('{"version":1,"root":{}}')).toBe('json');
  });

  it('detects json with leading whitespace', () => {
    expect(detectFormat('\n  \n{"version":1,"root":{}}')).toBe('json');
  });
});
