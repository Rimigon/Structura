import { create } from 'zustand';
import type { Preset, PresetConfig } from '@/types';
import { DEFAULT_DEDUP_CONFIG, DEFAULT_FLATTEN_CONFIG, DEFAULT_RENAME_CONFIG } from '@/types';
import {
  deletePreset as backendDelete,
  isTauri,
  listPresets,
  listTags,
  upsertPreset as backendUpsert,
  type PresetRow,
} from '@/lib/tauri';

interface PresetState {
  presets: Preset[];
  tags: string[];
  loaded: boolean;
  load(): Promise<void>;
  upsert(preset: Preset): Promise<void>;
  remove(id: string): Promise<void>;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'flatten-default',
    name: 'Свести (по умолчанию)',
    description: 'Переносит все файлы в корень. При совпадении имён добавляется префикс с именем родительской папки.',
    config: { kind: 'flatten', flatten: DEFAULT_FLATTEN_CONFIG },
    tags: ['flatten', 'стандарт'],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'flatten-counter-only',
    name: 'Свести (только счётчик)',
    description: 'При совпадении имён добавляется счётчик -2, -3, … без префикса папки.',
    config: {
      kind: 'flatten',
      flatten: { conflictStrategy: 'counter-only', cleanupEmpty: true, maxFileSizeBytes: null },
    },
    tags: ['flatten'],
    createdAt: 0,
    updatedAt: 0,
  },
];

export const usePresetStore = create<PresetState>()(set => ({
  presets: DEFAULT_PRESETS,
  tags: [],
  loaded: false,
  load: async () => {
    if (!isTauri()) {
      set({ loaded: true });
      return;
    }
    try {
      const rows = await listPresets();
      if (rows.length === 0) {
        for (const p of DEFAULT_PRESETS) {
          await backendUpsert(toRow(p));
        }
        const fresh = await listPresets();
        set({ presets: fresh.map(fromRow), loaded: true });
      } else {
        set({ presets: rows.map(fromRow), loaded: true });
      }
      const tags = await listTags();
      set({ tags });
    } catch (e) {
      console.error('preset load failed', e);
      set({ loaded: true });
    }
  },
  upsert: async preset => {
    const withTimestamps: Preset = {
      ...preset,
      createdAt: preset.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    if (isTauri()) {
      await backendUpsert(toRow(withTimestamps));
      const [presets, tags] = await Promise.all([listPresets(), listTags()]);
      set({ presets: presets.map(fromRow), tags });
    } else {
      set(state => {
        const idx = state.presets.findIndex(p => p.id === withTimestamps.id);
        const next = [...state.presets];
        if (idx >= 0) next[idx] = withTimestamps;
        else next.push(withTimestamps);
        return { presets: next };
      });
    }
  },
  remove: async id => {
    if (isTauri()) {
      await backendDelete(id);
      const presets = await listPresets();
      set({ presets: presets.map(fromRow) });
    } else {
      set(state => ({ presets: state.presets.filter(p => p.id !== id) }));
    }
  },
}));

function toRow(p: Preset): PresetRow {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    configJson: JSON.stringify(p.config),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    tags: p.tags,
  };
}

function fromRow(r: PresetRow): Preset {
  let config: PresetConfig = { kind: 'flatten', flatten: DEFAULT_FLATTEN_CONFIG };
  try {
    const parsed = JSON.parse(r.configJson) as unknown;
    config = normalizeConfig(parsed);
  } catch {
    /* fall through to default */
  }
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    config,
    tags: r.tags,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function normalizeConfig(raw: unknown): PresetConfig {
  if (!raw || typeof raw !== 'object') {
    return { kind: 'flatten', flatten: DEFAULT_FLATTEN_CONFIG };
  }
  const o = raw as { kind?: string };
  if (o.kind === 'flatten') {
    const f = (raw as { flatten?: unknown }).flatten;
    return {
      kind: 'flatten',
      flatten:
        f && typeof f === 'object'
          ? { ...DEFAULT_FLATTEN_CONFIG, ...(f as object) }
          : DEFAULT_FLATTEN_CONFIG,
    };
  }
  if (o.kind === 'rename') {
    const r = (raw as { rename?: unknown }).rename;
    if (r && typeof r === 'object') {
      const obj = r as Record<string, unknown>;
      // Migrate the v0 stub shape `{pattern, variables}` if encountered.
      if (typeof obj.template !== 'string' && typeof obj.pattern === 'string') {
        return {
          kind: 'rename',
          rename: {
            ...DEFAULT_RENAME_CONFIG,
            template: obj.pattern as string,
          },
        };
      }
      return {
        kind: 'rename',
        rename: { ...DEFAULT_RENAME_CONFIG, ...(obj as object) },
      };
    }
    return { kind: 'rename', rename: DEFAULT_RENAME_CONFIG };
  }
  if (o.kind === 'dedup') {
    const d = (raw as { dedup?: unknown }).dedup;
    return {
      kind: 'dedup',
      dedup:
        d && typeof d === 'object'
          ? { ...DEFAULT_DEDUP_CONFIG, ...(d as object) }
          : DEFAULT_DEDUP_CONFIG,
    };
  }
  return { kind: 'flatten', flatten: DEFAULT_FLATTEN_CONFIG };
}
