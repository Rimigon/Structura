import { describe, expect, it } from 'vitest';
import { resolveName } from '@/core/flatten/conflictResolver';

describe('resolveName', () => {
  it('returns name when free', () => {
    expect(resolveName('file.txt', 'a', new Set(), 'parent-prefix-then-counter')).toBe(
      'file.txt',
    );
  });

  it('prefixes with parent on collision', () => {
    expect(
      resolveName(
        'file.txt',
        'a',
        new Set(['file.txt']),
        'parent-prefix-then-counter',
      ),
    ).toBe('a-file.txt');
  });

  it('falls back to counter when prefix also collides', () => {
    expect(
      resolveName(
        'file.txt',
        'a',
        new Set(['file.txt', 'a-file.txt']),
        'parent-prefix-then-counter',
      ),
    ).toBe('a-file-2.txt');
  });

  it('increments counter further when multiple numbered conflicts exist', () => {
    expect(
      resolveName(
        'file.txt',
        'a',
        new Set(['file.txt', 'a-file.txt', 'a-file-2.txt', 'a-file-3.txt']),
        'parent-prefix-then-counter',
      ),
    ).toBe('a-file-4.txt');
  });

  it('splits multi-dot extensions on the last dot', () => {
    expect(
      resolveName(
        'archive.tar.gz',
        'a',
        new Set(['archive.tar.gz', 'a-archive.tar.gz']),
        'parent-prefix-then-counter',
      ),
    ).toBe('a-archive.tar-2.gz');
  });

  it('handles extensionless files', () => {
    expect(
      resolveName(
        'Makefile',
        'src',
        new Set(['Makefile', 'src-Makefile']),
        'parent-prefix-then-counter',
      ),
    ).toBe('src-Makefile-2');
  });

  it('counter-only skips parent prefix', () => {
    expect(
      resolveName('file.txt', 'a', new Set(['file.txt']), 'counter-only'),
    ).toBe('file-2.txt');
  });

  it('overwrite returns name unchanged', () => {
    expect(
      resolveName('file.txt', 'a', new Set(['file.txt']), 'overwrite'),
    ).toBe('file.txt');
  });
});
