import { splitExt } from '../tree/paths';

export interface TemplateVars {
  file: string;
  parent: string;
  grandparent?: string;
  counter?: number;
}

export function applyTemplate(template: string, vars: TemplateVars): string {
  const { base, ext } = splitExt(vars.file);
  const map: Record<string, string> = {
    '{file}': vars.file,
    '{base}': base,
    '{ext}': ext,
    '{parent}': vars.parent,
    '{grandparent}': vars.grandparent ?? '',
    '{counter}': vars.counter !== undefined ? String(vars.counter) : '',
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
];
