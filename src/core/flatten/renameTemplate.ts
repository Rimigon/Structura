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

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function nowParts(): {
  date: string;
  datetime: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const d = new Date();
  const y = String(d.getFullYear());
  const mo = pad(d.getMonth() + 1, 2);
  const da = pad(d.getDate(), 2);
  const h = pad(d.getHours(), 2);
  const mi = pad(d.getMinutes(), 2);
  return {
    date: `${y}-${mo}-${da}`,
    datetime: `${y}-${mo}-${da}_${h}-${mi}`,
    year: y,
    month: mo,
    day: da,
    hour: h,
    minute: mi,
  };
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  const { base, ext } = splitExt(vars.file);
  const exifDate = vars.exifDate ? normalizeExifDate(vars.exifDate) : '';
  const now = nowParts();
  const counter = vars.counter;

  // Plain (fixed-width) substitutions first.
  const map: Record<string, string> = {
    '{file}': vars.file,
    '{name}': base,
    '{base}': base,
    '{ext}': ext,
    '{parent}': vars.parent,
    '{grandparent}': vars.grandparent ?? '',
    '{counter}': counter !== undefined ? String(counter) : '',
    '{n}': counter !== undefined ? String(counter) : '',
    '{date}': now.date,
    '{datetime}': now.datetime,
    '{year}': now.year,
    '{month}': now.month,
    '{day}': now.day,
    '{hour}': now.hour,
    '{minute}': now.minute,
    '{exif_date}': exifDate,
    '{exif_camera}': vars.exifCamera ? sanitize(vars.exifCamera) : '',
    '{exif_lens}': vars.exifLens ? sanitize(vars.exifLens) : '',
    '{exif_width}': vars.exifWidth ? String(vars.exifWidth) : '',
    '{exif_height}': vars.exifHeight ? String(vars.exifHeight) : '',
    '{id3_artist}': vars.id3Artist ? sanitize(vars.id3Artist) : '',
    '{id3_title}': vars.id3Title ? sanitize(vars.id3Title) : '',
    '{id3_album}': vars.id3Album ? sanitize(vars.id3Album) : '',
    '{id3_year}': vars.id3Year ? String(vars.id3Year) : '',
    '{id3_track}': vars.id3Track ? pad(vars.id3Track, 2) : '',
  };

  // Padded counter: {n:02}, {n:03}, {counter:04}, etc.
  let result = template.replace(/\{(n|counter):(\d+)\}/g, (_, _tag, w) => {
    if (counter === undefined) return '';
    return pad(counter, parseInt(w, 10));
  });

  for (const [key, value] of Object.entries(map)) {
    result = result.split(key).join(value);
  }
  return result.trim();
}

// Preset library ----------------------------------------------------------

export type TemplateCategory =
  | 'general'
  | 'numbered'
  | 'photo'
  | 'music'
  | 'video'
  | 'docs';

export interface TemplatePreset {
  label: string;
  template: string;
  hint: string;
  category: TemplateCategory;
  /** English fallback for UI. */
  labelEn?: string;
  hintEn?: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ---- General -----------------------------------------------------------
  {
    category: 'general',
    label: 'Имя без изменений',
    labelEn: 'Keep original name',
    template: '{file}',
    hint: 'оставить как было',
    hintEn: 'leave as-is',
  },
  {
    category: 'general',
    label: 'Родитель — имя',
    labelEn: 'Parent — name',
    template: '{parent} — {file}',
    hint: 'Фото — IMG_001.jpg',
    hintEn: 'Photos — IMG_001.jpg',
  },
  {
    category: 'general',
    label: 'Родитель_имя',
    labelEn: 'Parent_name',
    template: '{parent}_{file}',
    hint: 'Фото_IMG_001.jpg',
    hintEn: 'Photos_IMG_001.jpg',
  },
  {
    category: 'general',
    label: 'Родитель-имя.ext',
    labelEn: 'Parent-name.ext',
    template: '{parent}-{base}{ext}',
    hint: 'Фото-IMG_001.jpg',
    hintEn: 'Photos-IMG_001.jpg',
  },
  {
    category: 'general',
    label: '[Родитель] имя',
    labelEn: '[Parent] name',
    template: '[{parent}] {file}',
    hint: '[Фото] IMG_001.jpg',
    hintEn: '[Photos] IMG_001.jpg',
  },

  // ---- Numbered ----------------------------------------------------------
  {
    category: 'numbered',
    label: 'Счётчик: 01.ext',
    labelEn: 'Counter: 01.ext',
    template: '{n:02}{ext}',
    hint: '01.jpg, 02.jpg, …',
    hintEn: '01.jpg, 02.jpg, …',
  },
  {
    category: 'numbered',
    label: 'Счётчик: 001.ext',
    labelEn: 'Counter: 001.ext',
    template: '{n:03}{ext}',
    hint: '001.jpg, 002.jpg, …',
    hintEn: '001.jpg, 002.jpg, …',
  },
  {
    category: 'numbered',
    label: 'Родитель + счётчик',
    labelEn: 'Parent + counter',
    template: '{parent}_{n:03}{ext}',
    hint: 'Отпуск_001.jpg, Отпуск_002.jpg, …',
    hintEn: 'Vacation_001.jpg, Vacation_002.jpg, …',
  },
  {
    category: 'numbered',
    label: 'Имя + счётчик',
    labelEn: 'Name + counter',
    template: '{base}_{n:03}{ext}',
    hint: 'IMG_001.jpg → IMG_001_001.jpg',
    hintEn: 'IMG_001.jpg → IMG_001_001.jpg',
  },
  {
    category: 'numbered',
    label: 'IMG_0001.ext',
    labelEn: 'IMG_0001.ext',
    template: 'IMG_{n:04}{ext}',
    hint: 'IMG_0001.jpg, IMG_0002.jpg, …',
    hintEn: 'IMG_0001.jpg, IMG_0002.jpg, …',
  },
  {
    category: 'numbered',
    label: 'Дата + счётчик',
    labelEn: 'Date + counter',
    template: '{date}_{n:03}{ext}',
    hint: '2026-04-24_001.jpg, …',
    hintEn: '2026-04-24_001.jpg, …',
  },

  // ---- Photo / EXIF ------------------------------------------------------
  {
    category: 'photo',
    label: 'EXIF: дата — имя',
    labelEn: 'EXIF: date — name',
    template: '{exif_date} — {file}',
    hint: '2024-07-14 — IMG_0001.jpg',
    hintEn: '2024-07-14 — IMG_0001.jpg',
  },
  {
    category: 'photo',
    label: 'EXIF: дата_счётчик',
    labelEn: 'EXIF: date_counter',
    template: '{exif_date}_{n:03}{ext}',
    hint: '2024-07-14_001.jpg, 2024-07-14_002.jpg, …',
    hintEn: '2024-07-14_001.jpg, 2024-07-14_002.jpg, …',
  },
  {
    category: 'photo',
    label: 'EXIF: дата + камера',
    labelEn: 'EXIF: date + camera',
    template: '{exif_date} {exif_camera}{ext}',
    hint: '2024-07-14 iPhone 15.jpg',
    hintEn: '2024-07-14 iPhone 15.jpg',
  },
  {
    category: 'photo',
    label: 'EXIF: дата + камера + счётчик',
    labelEn: 'EXIF: date + camera + counter',
    template: '{exif_date}_{exif_camera}_{n:03}{ext}',
    hint: '2024-07-14_iPhone 15_001.jpg',
    hintEn: '2024-07-14_iPhone 15_001.jpg',
  },
  {
    category: 'photo',
    label: 'Путешествие: папка + дата + счётчик',
    labelEn: 'Trip: folder + date + counter',
    template: '{parent}_{exif_date}_{n:03}{ext}',
    hint: 'Отпуск_2024-07-14_001.jpg',
    hintEn: 'Vacation_2024-07-14_001.jpg',
  },

  // ---- Music / ID3 -------------------------------------------------------
  {
    category: 'music',
    label: 'ID3: трек. название',
    labelEn: 'ID3: track. title',
    template: '{id3_track}. {id3_title}{ext}',
    hint: '01. Airbag.mp3',
    hintEn: '01. Airbag.mp3',
  },
  {
    category: 'music',
    label: 'ID3: артист - название',
    labelEn: 'ID3: artist - title',
    template: '{id3_artist} - {id3_title}{ext}',
    hint: 'Radiohead - Airbag.mp3',
    hintEn: 'Radiohead - Airbag.mp3',
  },
  {
    category: 'music',
    label: 'ID3: артист - альбом - трек - название',
    labelEn: 'ID3: artist - album - track - title',
    template: '{id3_artist} - {id3_album} - {id3_track} - {id3_title}{ext}',
    hint: 'Radiohead - OK Computer - 01 - Airbag.mp3',
    hintEn: 'Radiohead - OK Computer - 01 - Airbag.mp3',
  },
  {
    category: 'music',
    label: 'ID3: альбом (год) — трек. название',
    labelEn: 'ID3: album (year) — track. title',
    template: '{id3_album} ({id3_year}) — {id3_track}. {id3_title}{ext}',
    hint: 'OK Computer (1997) — 01. Airbag.mp3',
    hintEn: 'OK Computer (1997) — 01. Airbag.mp3',
  },

  // ---- Video -------------------------------------------------------------
  {
    category: 'video',
    label: 'Дата — имя',
    labelEn: 'Date — name',
    template: '{date} — {base}{ext}',
    hint: '2026-04-24 — clip.mp4',
    hintEn: '2026-04-24 — clip.mp4',
  },
  {
    category: 'video',
    label: 'Папка + счётчик (VIDEO_001)',
    labelEn: 'Folder + counter (VIDEO_001)',
    template: '{parent}_VIDEO_{n:03}{ext}',
    hint: 'Отпуск_VIDEO_001.mp4',
    hintEn: 'Vacation_VIDEO_001.mp4',
  },

  // ---- Documents ---------------------------------------------------------
  {
    category: 'docs',
    label: 'Дата_имя',
    labelEn: 'Date_name',
    template: '{date}_{base}{ext}',
    hint: '2026-04-24_договор.pdf',
    hintEn: '2026-04-24_contract.pdf',
  },
  {
    category: 'docs',
    label: 'Имя версия (v01)',
    labelEn: 'Name version (v01)',
    template: '{base}_v{n:02}{ext}',
    hint: 'договор_v01.pdf, договор_v02.pdf, …',
    hintEn: 'contract_v01.pdf, contract_v02.pdf, …',
  },
  {
    category: 'docs',
    label: 'Родитель · имя',
    labelEn: 'Parent · name',
    template: '{parent} · {file}',
    hint: 'Отчёты · Q1 2026.pdf',
    hintEn: 'Reports · Q1 2026.pdf',
  },
];

export const CATEGORY_ORDER: TemplateCategory[] = [
  'general',
  'numbered',
  'photo',
  'music',
  'video',
  'docs',
];
