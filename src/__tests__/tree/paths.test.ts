import { describe, expect, it } from 'vitest';
import { basename, dirname, isValidName, joinPath, normalize, splitExt } from '@/core/tree/paths';

describe('paths', () => {
  it('joinPath with forward slashes', () => {
    expect(joinPath('/a', 'b', 'c')).toBe('/a/b/c');
  });

  it('joinPath preserves Windows separators', () => {
    expect(joinPath('C:\\foo', 'bar')).toBe('C:\\foo\\bar');
  });

  it('dirname / basename', () => {
    expect(dirname('/a/b/c.txt')).toBe('/a/b');
    expect(basename('/a/b/c.txt')).toBe('c.txt');
  });

  it('splitExt on single-dot', () => {
    expect(splitExt('file.txt')).toEqual({ base: 'file', ext: '.txt' });
  });

  it('splitExt on multi-dot splits on last', () => {
    expect(splitExt('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: '.gz' });
  });

  it('splitExt on extensionless', () => {
    expect(splitExt('Makefile')).toEqual({ base: 'Makefile', ext: '' });
  });

  it('splitExt on leading-dot file', () => {
    expect(splitExt('.gitignore')).toEqual({ base: '.gitignore', ext: '' });
  });

  it('isValidName rejects dangerous values', () => {
    expect(isValidName('ok.txt')).toBe(true);
    expect(isValidName('..')).toBe(false);
    expect(isValidName('.')).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('a/b')).toBe(false);
    expect(isValidName('a\\b')).toBe(false);
    expect(isValidName('a\0b')).toBe(false);
  });

  it('isValidName accepts Cyrillic and emoji names', () => {
    expect(isValidName('Рабочий стол')).toBe(true);
    expect(isValidName('проект-1')).toBe(true);
    expect(isValidName('файл.txt')).toBe(true);
    expect(isValidName('💾 backup')).toBe(true);
  });

  it('dirname handles Windows paths with backslashes', () => {
    expect(dirname('C:\\Users\\nikit\\file.txt')).toBe('C:\\Users\\nikit');
    expect(basename('C:\\Users\\nikit\\file.txt')).toBe('file.txt');
  });

  it('dirname on UNC path', () => {
    expect(dirname('\\\\server\\share\\folder\\file.txt')).toBe(
      '\\\\server\\share\\folder',
    );
  });

  it('joinPath with Cyrillic segments', () => {
    expect(joinPath('C:\\Users\\nikit\\OneDrive\\Рабочий стол', 'Structura')).toBe(
      'C:\\Users\\nikit\\OneDrive\\Рабочий стол\\Structura',
    );
  });

  it('joinPath handles trailing separator', () => {
    expect(joinPath('/a/', 'b')).toBe('/a/b');
    expect(joinPath('C:\\a\\', 'b')).toBe('C:\\a\\b');
  });

  it('normalize collapses mixed separators and duplicates', () => {
    expect(normalize('C:\\Users\\\\nikit/Desktop')).toBe('C:/Users/nikit/Desktop');
    expect(normalize('//a///b\\\\c')).toBe('/a/b/c');
  });
});
