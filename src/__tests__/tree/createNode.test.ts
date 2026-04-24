import { describe, expect, it, beforeEach } from 'vitest';
import type { FsEntry } from '@/types';
import { useTreeStore } from '@/stores/treeStore';

function resetStore() {
  useTreeStore.setState({
    rootId: null,
    nodes: {},
    rootFsPath: null,
    loading: false,
    error: null,
  });
}

function makeRoot() {
  const entries: FsEntry[] = [
    {
      path: '/tmp/root',
      relPath: '',
      name: 'root',
      isDir: true,
      size: 0,
      modified: 0,
      ext: '',
    },
    {
      path: '/tmp/root/existing.txt',
      relPath: 'existing.txt',
      name: 'existing.txt',
      isDir: false,
      size: 1,
      modified: 0,
      ext: 'txt',
    },
  ];
  useTreeStore.getState().loadFromEntries(entries, '/tmp/root');
  return useTreeStore.getState().rootId!;
}

describe('treeStore.createNode — collision handling', () => {
  beforeEach(() => resetStore());

  it('auto-suffixes when a sibling with the same name already exists on disk', () => {
    const rootId = makeRoot();
    const newId = useTreeStore.getState().createNode(rootId, 'file', 'existing.txt');
    expect(newId).toBeTruthy();
    const node = useTreeStore.getState().nodes[newId!]!;
    expect(node.name).toBe('existing (2).txt');
  });

  it('auto-suffixes when multiple new files are created with the same default name', () => {
    const rootId = makeRoot();
    const store = useTreeStore.getState();
    const id1 = store.createNode(rootId, 'file', 'new-file');
    const id2 = store.createNode(rootId, 'file', 'new-file');
    const id3 = store.createNode(rootId, 'file', 'new-file');
    const names = [id1, id2, id3].map(id => useTreeStore.getState().nodes[id!]!.name);
    // Names must all be distinct
    expect(new Set(names).size).toBe(3);
    expect(names).toContain('new-file');
    expect(names).toContain('new-file (2)');
    expect(names).toContain('new-file (3)');
  });

  it('also auto-suffixes when multiple new folders share the same default name', () => {
    const rootId = makeRoot();
    const store = useTreeStore.getState();
    const id1 = store.createNode(rootId, 'dir', 'new-folder');
    const id2 = store.createNode(rootId, 'dir', 'new-folder');
    const names = [id1, id2].map(id => useTreeStore.getState().nodes[id!]!.name);
    expect(new Set(names).size).toBe(2);
    expect(names).toContain('new-folder');
    expect(names).toContain('new-folder (2)');
  });

  it('ignores deleted siblings when computing uniqueness', () => {
    const rootId = makeRoot();
    const store = useTreeStore.getState();
    // Delete the existing file (soft delete = dirty: 'deleted')
    const existingId = Object.values(store.nodes).find(
      n => n.name === 'existing.txt',
    )!.id;
    store.deleteNode(existingId);
    // Now creating a file with the same name should NOT auto-suffix
    const newId = store.createNode(rootId, 'file', 'existing.txt');
    const node = useTreeStore.getState().nodes[newId!]!;
    expect(node.name).toBe('existing.txt');
  });

  it('preserves the file extension when suffixing', () => {
    const rootId = makeRoot();
    const store = useTreeStore.getState();
    store.createNode(rootId, 'file', 'report.pdf');
    const second = store.createNode(rootId, 'file', 'report.pdf');
    const node = useTreeStore.getState().nodes[second!]! as { ext: string; name: string };
    expect(node.name).toBe('report (2).pdf');
    expect(node.ext).toBe('pdf');
  });
});
