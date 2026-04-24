import { splitExt } from '../tree/paths';

export interface TemplateVars {
  file: string;
  parent: string;
  grandparent?: string;
  counter?: number;
  /** Metadata (pre-fetched for batch rename / photo organizer). */
  exifDate?: string;
  exifCamera?: string;
  exifLens?: string;
  exifWidth?: number;
  exifHeight?: number;
  id3Artist?: string;
  id3Title?: string;
  id3Album?: string;
  id3Year?: number;
  id3Track?: number;
}

function sanitize(raw: string): string {
  return raw.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeExifDate(raw: string): string {
  const m = /(\d{4})[-:](\d{2})[-:](\d{2})/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return raw;
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  const { base, ext } = splitExt(vars.file);
  const exifDate = vars.exifDate ? normalizeExifDate(vars.exifDate) : '';
  const map: Record<string, string> = {
    '{file}': vars.file,
    '{base}': base,
    '{ext}': ext,
    '{parent}': vars.parent,
    '{grandparent}': vars.grandparent ?? '',
    '{counter}': vars.counter !== undefined ? String(vars.counter) : '',
    '{exif_date}': exifDate,
    '{exif_camera}': vars.exifCamera ? sanitize(vars.exifCamera) : '',
    '{exif_lens}': vars.exifLens ? sanitize(vars.exifLens) : '',
    '{exif_width}': vars.exifWidth ? String(vars.exifWidth) : '',
    '{exif_height}': vars.exifHeight ? String(vars.exifHeight) : '',
    '{id3_artist}': vars.id3Artist ? sanitize(vars.id3Artist) : '',
    '{id3_title}': vars.id3Title ? sanitize(vars.id3Title) : '',
    '{id3_album}': vars.id3Album ? sanitize(vars.id3Album) : '',
    '{id3_year}': vars.id3Year ? String(vars.id3Year) : '',
    '{id3_track}': vars.id3Track ? String(vars.id3Track).padStart(2, '0') : '',
  };
  let result = template;
  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }
  return result.trim();
}

export const TEMPLATE_PRESETS: { label: string; template: string; hint: string }[] = [
  {
    label: 'Имя без изменений',
    template: '{file}',
    hint: 'оставить как было',
  },
  {
    label: 'Родитель — имя',
    template: '{parent} — {file}',
    hint: 'Фото — IMG_001.jpg',
  },
  {
    label: 'Родитель_имя',
    template: '{parent}_{file}',
    hint: 'Фото_IMG_001.jpg',
  },
  {
    label: 'Родитель-база.ext',
    template: '{parent}-{base}{ext}',
    hint: 'Фото-IMG_001.jpg',
  },
  {
    label: '[Родитель] имя',
    template: '[{parent}] {file}',
    hint: '[Фото] IMG_001.jpg',
  },
  {
    label: 'EXIF: дата — имя',
    template: '{exif_date} — {file}',
    hint: '2024-07-14 — IMG_0001.jpg',
  },
  {
    label: 'EXIF: дата + камера',
    template: '{exif_date} {exif_camera}{ext}',
    hint: '2024-07-14 iPhone 15.jpg',
  },
  {
    label: 'ID3: артист - альбом - трек - название',
    template: '{id3_artist} - {id3_album} - {id3_track} - {id3_title}{ext}',
    hint: 'Radiohead - OK Computer - 01 - Airbag.mp3',
  },
  {
    label: 'ID3: трек. название',
    template: '{id3_track}. {id3_title}{ext}',
    hint: '01. Airbag.mp3',
  },
];
