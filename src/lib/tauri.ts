import { invoke } from '@tauri-apps/api/core';
import type {
  DuplicateGroup,
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

export async function findDuplicates(
  rootFsPath: string,
  minSizeBytes?: number,
): Promise<DuplicateGroup[]> {
  return invoke<DuplicateGroup[]>('find_duplicates', {
    rootFsPath,
    minSizeBytes: minSizeBytes ?? null,
  });
}

export interface SearchContentOptions {
  caseSensitive?: boolean;
  maxFileSizeBytes?: number;
  maxResults?: number;
  includeHidden?: boolean;
}

export interface ContentMatch {
  path: string;
  line: number;
  preview: string;
}

export interface SearchContentResult {
  matches: ContentMatch[];
  scannedFiles: number;
  truncated: boolean;
}

export async function searchContent(
  rootFsPath: string,
  query: string,
  opts?: SearchContentOptions,
): Promise<SearchContentResult> {
  return invoke<SearchContentResult>('search_content', {
    rootFsPath,
    query,
    opts: opts ?? null,
  });
}

export interface WatchInfo {
  id: string;
  path: string;
  recursive: boolean;
}

export interface WatchEventPayload {
  watchId: string;
  kind: 'create' | 'modify' | 'remove' | 'access' | 'other' | 'any';
  paths: string[];
  timestamp: number;
}

export async function subscribeWatch(
  path: string,
  recursive = true,
): Promise<string> {
  return invoke<string>('subscribe_watch', { path, recursive });
}

export async function unsubscribeWatch(id: string): Promise<void> {
  return invoke<void>('unsubscribe_watch', { id });
}

export async function listWatches(): Promise<WatchInfo[]> {
  return invoke<WatchInfo[]>('list_watches');
}

export async function openFloatingWidget(): Promise<void> {
  return invoke<void>('open_floating_widget');
}

export async function closeFloatingWidget(): Promise<void> {
  return invoke<void>('close_floating_widget');
}

export interface MediaMetadata {
  kind: 'image' | 'audio' | 'video' | 'other';
  exifDate?: string | null;
  exifCamera?: string | null;
  exifLens?: string | null;
  exifWidth?: number | null;
  exifHeight?: number | null;
  id3Artist?: string | null;
  id3Title?: string | null;
  id3Album?: string | null;
  id3Year?: number | null;
  id3Track?: number | null;
}

export async function extractMetadata(path: string): Promise<MediaMetadata> {
  return invoke<MediaMetadata>('extract_metadata', { path });
}

export interface ShellIntegrationStatus {
  platform: string;
  installed: boolean;
  supported: boolean;
  note: string;
}

export async function shellIntegrationStatus(): Promise<ShellIntegrationStatus> {
  return invoke<ShellIntegrationStatus>('shell_integration_status');
}

export async function installShellIntegration(): Promise<void> {
  return invoke<void>('install_shell_integration');
}

export async function uninstallShellIntegration(): Promise<void> {
  return invoke<void>('uninstall_shell_integration');
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
