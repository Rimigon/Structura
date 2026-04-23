import { invoke } from '@tauri-apps/api/core';
import type {
  FsEntry,
  ScanOptions,
  Transaction,
  TxResult,
} from '@/types';

export async function scanDirectory(
  path: string,
  opts: ScanOptions,
): Promise<FsEntry[]> {
  return invoke<FsEntry[]>('scan_directory', { path, opts });
}

export async function pickDirectory(): Promise<string | null> {
  return invoke<string | null>('pick_directory');
}

export async function pickOpenFile(
  filterName?: string,
  extensions?: string[],
): Promise<string | null> {
  return invoke<string | null>('pick_open_file', { filterName, extensions });
}

export async function pickSaveFile(
  suggestedName?: string,
  filterName?: string,
  extensions?: string[],
): Promise<string | null> {
  return invoke<string | null>('pick_save_file', {
    suggestedName,
    filterName,
    extensions,
  });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content });
}

export async function applyTransaction(tx: Transaction): Promise<TxResult> {
  return invoke<TxResult>('apply_transaction', { tx });
}

export async function statPath(path: string): Promise<FsEntry> {
  return invoke<FsEntry>('stat_path', { path });
}

export async function revealInOs(path: string): Promise<void> {
  return invoke<void>('reveal_in_os', { path });
}

export interface DiskCheck {
  available: number;
  required: number;
  sufficient: boolean;
}

export async function checkDiskSpace(
  rootFsPath: string,
  requiredBytes: number,
): Promise<DiskCheck> {
  return invoke<DiskCheck>('check_disk_space', {
    rootFsPath,
    requiredBytes,
  });
}

export interface PresetRow {
  id: string;
  name: string;
  description?: string;
  configJson: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export async function listPresets(): Promise<PresetRow[]> {
  return invoke<PresetRow[]>('list_presets');
}

export async function upsertPreset(preset: PresetRow): Promise<void> {
  return invoke<void>('upsert_preset', { preset });
}

export async function deletePreset(id: string): Promise<void> {
  return invoke<void>('delete_preset', { id });
}

export async function listTags(): Promise<string[]> {
  return invoke<string[]>('list_tags');
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
