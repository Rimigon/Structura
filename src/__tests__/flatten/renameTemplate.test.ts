import { describe, expect, it } from 'vitest';
import { applyTemplate } from '@/core/flatten/renameTemplate';

describe('applyTemplate', () => {
  it('substitutes file/base/ext/parent', () => {
    expect(
      applyTemplate('{parent}-{base}{ext}', {
        file: 'IMG_001.jpg',
        parent: 'Photos',
      }),
    ).toBe('Photos-IMG_001.jpg');
  });

  it('{name} is alias for {base}', () => {
    expect(
      applyTemplate('{name}.txt', { file: 'report.md', parent: 'docs' }),
    ).toBe('report.txt');
  });

  it('plain {n} counter', () => {
    expect(
      applyTemplate('{n}.jpg', { file: 'a.jpg', parent: 'p', counter: 7 }),
    ).toBe('7.jpg');
  });

  it('padded {n:02} counter', () => {
    expect(
      applyTemplate('{n:02}.jpg', { file: 'a.jpg', parent: 'p', counter: 3 }),
    ).toBe('03.jpg');
  });

  it('padded {n:04} counter', () => {
    expect(
      applyTemplate('IMG_{n:04}{ext}', {
        file: 'x.jpg',
        parent: 'p',
        counter: 12,
      }),
    ).toBe('IMG_0012.jpg');
  });

  it('padded {counter:03} still works', () => {
    expect(
      applyTemplate('{parent}_{counter:03}{ext}', {
        file: 'x.png',
        parent: 'P',
        counter: 1,
      }),
    ).toBe('P_001.png');
  });

  it('empty counter is substituted as empty string', () => {
    expect(
      applyTemplate('a_{n}_{n:02}', { file: 'x', parent: 'y' }),
    ).toBe('a__');
  });

  it('EXIF date is normalised from 2024:07:14 to 2024-07-14', () => {
    expect(
      applyTemplate('{exif_date} {file}', {
        file: 'x.jpg',
        parent: 'p',
        exifDate: '2024:07:14 12:00:00',
      }),
    ).toBe('2024-07-14 x.jpg');
  });

  it('ID3 track is zero-padded', () => {
    expect(
      applyTemplate('{id3_track}. {id3_title}{ext}', {
        file: 'x.mp3',
        parent: 'album',
        id3Track: 3,
        id3Title: 'Airbag',
      }),
    ).toBe('03. Airbag.mp3');
  });

  it('{date} injects YYYY-MM-DD', () => {
    const out = applyTemplate('{date}_{file}', { file: 'x.txt', parent: 'p' });
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}_x\.txt$/);
  });

  it('sanitises EXIF camera name of filesystem-invalid chars', () => {
    expect(
      applyTemplate('{exif_camera}{ext}', {
        file: 'x.jpg',
        parent: 'p',
        exifCamera: 'Cam/Model:1?',
      }),
    ).toBe('CamModel1.jpg');
  });
});
