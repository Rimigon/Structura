import { create } from 'zustand';
import type { Operation, Transaction } from '@/types';
import { DEFAULT_FLATTEN_CONFIG } from '@/types';
import type { WatchEventPayload, WatchInfo } from '@/lib/tauri';
import {
  applyTransaction,
  isTauri,
  listWatches,
  scanDirectory,
  subscribeWatch,
  unsubscribeWatch,
} from '@/lib/tauri';
import { matchGlob } from '@/core/search/glob';
import { buildTree } from '@/core/tree/build';
import { flatten } from '@/core/flatten/flatten';
import { usePresetStore } from './presetStore';
import { useTreeStore } from './treeStore';

const MAX_EVENT_LOG = 200;

export type RuleAction = 'notify' | 'apply';

export interface WatcherRule {
  id: string;
  glob: string;
  presetId: string | null;
  action: RuleAction;
}

export interface EnrichedEvent extends WatchEventPayload {
  matchedRuleIds?: string[];
  appliedPresetNames?: string[];
}

interface WatcherState {
  watches: WatchInfo[];
  events: EnrichedEvent[];
  rules: Record<string, WatcherRule[]>;
  load(): Promise<void>;
  subscribe(path: string, recursive?: boolean): Promise<string | null>;
  unsubscribe(id: string): Promise<void>;
  pushEvent(event: WatchEventPayload): Promise<void>;
  clearEvents(): void;
  addRule(watchId: string, rule: Omit<WatcherRule, 'id'>): void;
  removeRule(watchId: string, ruleId: string): void;
  updateRule(watchId: string, rule: WatcherRule): void;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

function parentOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i > 0 ? p.slice(0, i) : p;
}

async function applyPresetToPath(
  presetId: string,
  targetFsPath: string,
): Promise<string | null> {
  const preset = usePresetStore.getState().presets.find(p => p.id === presetId);
  if (!preset || preset.config.kind !== 'flatten') return null;
  const entries = await scanDirectory(targetFsPath, {
    maxDepth: null,
    followSymlinks: false,
    includeHidden: false,
    ignorePatterns: [],
  });
  const state = buildTree(entries, targetFsPath);
  if (!state.rootId) return null;
  const { tx } = flatten(
    { rootId: state.rootId, nodes: state.nodes, rootFsPath: targetFsPath },
    state.rootId,
    preset.config.flatten ?? DEFAULT_FLATTEN_CONFIG,
  );
  if (tx.ops.length === 0) return preset.name;
  const transaction: Transaction = {
    id: 'watcher_' + Date.now().toString(36),
    createdAt: Date.now(),
    label: `Watcher → ${preset.name}`,
    rootFsPath: targetFsPath,
    ops: tx.ops as Operation[],
    inverse: [],
    continueOnError: true,
  };
  await applyTransaction(transaction);
  const currentRoot = useTreeStore.getState().rootFsPath;
  if (
    currentRoot &&
    (targetFsPath === currentRoot || targetFsPath.startsWith(currentRoot))
  ) {
    await useTreeStore.getState().scanRoot(currentRoot);
  }
  return preset.name;
}

export const useWatcherStore = create<WatcherState>((set, get) => ({
  watches: [],
  events: [],
  rules: {},

  load: async () => {
    if (!isTauri()) return;
    try {
      const watches = await listWatches();
      set({ watches });
    } catch {
      /* ignore */
    }
  },

  subscribe: async (path, recursive = true) => {
    if (!isTauri()) return null;
    try {
      const id = await subscribeWatch(path, recursive);
      await get().load();
      return id;
    } catch (e) {
      console.error('watch subscribe failed', e);
      return null;
    }
  },

  unsubscribe: async id => {
    if (!isTauri()) return;
    try {
      await unsubscribeWatch(id);
      await get().load();
    } catch (e) {
      console.error('watch unsubscribe failed', e);
    }
  },

  pushEvent: async event => {
    const rules = get().rules[event.watchId] ?? [];
    const enriched: EnrichedEvent = { ...event };
    const matched: WatcherRule[] = [];
    for (const rule of rules) {
      for (const p of event.paths) {
        if (matchGlob(rule.glob, basename(p))) {
          matched.push(rule);
          break;
        }
      }
    }
    if (matched.length > 0) {
      enriched.matchedRuleIds = matched.map(r => r.id);
    }
    set(state => ({
      events: [enriched, ...state.events].slice(0, MAX_EVENT_LOG),
    }));
    // Execute apply actions for matched rules on 'create' events
    if (event.kind === 'create' && matched.length > 0 && event.paths.length > 0) {
      const targetDir = parentOf(event.paths[0]!);
      const applied: string[] = [];
      for (const rule of matched) {
        if (rule.action === 'apply' && rule.presetId) {
          try {
            const name = await applyPresetToPath(rule.presetId, targetDir);
            if (name) applied.push(name);
          } catch (e) {
            console.error('watcher auto-apply failed', e);
          }
        }
      }
      if (applied.length > 0) {
        set(state => ({
          events: state.events.map(e =>
            e.timestamp === enriched.timestamp && e.watchId === enriched.watchId
              ? { ...e, appliedPresetNames: applied }
              : e,
          ),
        }));
      }
    }
  },

  clearEvents: () => set({ events: [] }),

  addRule: (watchId, rule) =>
    set(state => {
      const existing = state.rules[watchId] ?? [];
      const id = 'rule_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return {
        rules: { ...state.rules, [watchId]: [...existing, { ...rule, id }] },
      };
    }),

  removeRule: (watchId, ruleId) =>
    set(state => {
      const existing = state.rules[watchId] ?? [];
      return {
        rules: { ...state.rules, [watchId]: existing.filter(r => r.id !== ruleId) },
      };
    }),

  updateRule: (watchId, rule) =>
    set(state => {
      const existing = state.rules[watchId] ?? [];
      return {
        rules: {
          ...state.rules,
          [watchId]: existing.map(r => (r.id === rule.id ? rule : r)),
        },
      };
    }),
}));
