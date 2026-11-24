import { describe, expect, it, vi } from 'vitest';
import { createMockStorage } from '../src/cloud/mockStorage.js';
import { createCloudMetaStore, hasUserContent, META_NAMESPACE, sanitizeMeta, selectMetaStore } from '../src/features/github-repos/metaStore.js';

const NOW = () => new Date('2026-11-24T00:00:00Z');

describe('cloud meta store on portal document storage', () => {
  it('writes one document per repository key in its own namespace', async () => {
    const cloud = createMockStorage();
    const store = createCloudMetaStore(cloud, { now: NOW });
    await store.set('github:42', { note: 'keep', tags: ['MCP', 'mcp'], favorite: true, name: 'alpha', url: 'https://github.com/cxr542/alpha' });
    expect(cloud.read(META_NAMESPACE, 'github:42')).toMatchObject({ key: 'github:42', note: 'keep', tags: ['MCP'], favorite: true, name: 'alpha', updatedAt: '2026-11-24T00:00:00.000Z' });
    expect(cloud.list('settings')).toEqual([]);
  });

  it('restores saved data in a new store instance (simulated reload)', async () => {
    const cloud = createMockStorage();
    await createCloudMetaStore(cloud).set('github:7', { note: 'persisted', category: 'AI·에이전트' });
    const reloaded = createCloudMetaStore(cloud);
    expect(reloaded.get('github:7')).toMatchObject({ note: 'persisted', category: 'AI·에이전트' });
    expect(reloaded.storedKeys()).toEqual(['github:7']);
  });

  it('merges patches without dropping earlier fields', async () => {
    const store = createCloudMetaStore(createMockStorage());
    await store.set('github:1', { note: 'n', tags: ['a'] });
    await store.set('github:1', { favorite: true });
    expect(store.get('github:1')).toMatchObject({ note: 'n', tags: ['a'], favorite: true });
  });

  it('uses defaults until the user saves, and never writes defaults on its own', async () => {
    const cloud = createMockStorage();
    const write = vi.spyOn(cloud, 'write');
    const store = createCloudMetaStore(cloud, { defaults: { 'fixture:demo': { category: '학습·실험', status: '실험' } } });
    expect(store.get('fixture:demo')).toMatchObject({ category: '학습·실험' });
    expect(write).not.toHaveBeenCalled();
    await store.set('fixture:demo', { note: 'mine' });
    expect(store.get('fixture:demo')).toMatchObject({ category: '학습·실험', note: 'mine' });
  });

  it('notifies subscribers with a new, stable snapshot', async () => {
    const store = createCloudMetaStore(createMockStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.all();
    expect(store.all()).toBe(before);
    await store.set('github:1', { note: 'x' });
    expect(listener).toHaveBeenCalled();
    expect(store.all()).not.toBe(before);
    expect(store.all()).toBe(store.all());
  });

  it('keeps the optimistic value and rejects when storage fails', async () => {
    const cloud = createMockStorage();
    cloud.write = vi.fn(() => Promise.reject(new Error('portal_write_conflict')));
    const store = createCloudMetaStore(cloud);
    await expect(store.set('github:3', { note: 'unsaved' })).rejects.toThrow('portal_write_conflict');
    expect(store.get('github:3')).toMatchObject({ note: 'unsaved' });
  });

  it('shows the optimistic value before storage confirms', async () => {
    const cloud = createMockStorage();
    let release;
    cloud.write = vi.fn(() => new Promise(resolve => { release = resolve; }));
    const store = createCloudMetaStore(cloud);
    const pending = store.set('github:4', { favorite: true });
    expect(store.get('github:4').favorite).toBe(true);
    release();
    await pending;
  });

  it('removes a document with a tombstone', async () => {
    const cloud = createMockStorage();
    const store = createCloudMetaStore(cloud);
    await store.set('github:5', { note: 'gone soon' });
    await store.remove('github:5');
    expect(store.get('github:5')).toBeNull();
    expect(cloud.list(META_NAMESPACE)).toEqual([]);
    expect(createCloudMetaStore(cloud).storedKeys()).toEqual([]);
  });

  it.each(['../x', 'github:', 'github:abc', 'settings', 'fixture:has space', ''])('rejects invalid key %s before writing', async key => {
    const cloud = createMockStorage();
    const write = vi.spyOn(cloud, 'write');
    const store = createCloudMetaStore(cloud);
    await expect(store.set(key, { note: 'x' })).rejects.toThrow('invalid_repository_key');
    await expect(store.remove(key)).rejects.toThrow('invalid_repository_key');
    expect(write).not.toHaveBeenCalled();
  });

  it('ignores malformed stored documents', async () => {
    const cloud = createMockStorage();
    await cloud.write(META_NAMESPACE, 'bad', { key: '../evil', note: 'x' });
    await cloud.write(META_NAMESPACE, 'github:9', { key: 'github:9', note: 123, tags: 'nope', favorite: 'yes', url: 'javascript:alert(1)' });
    const store = createCloudMetaStore(cloud);
    expect(store.storedKeys()).toEqual(['github:9']);
    expect(store.get('github:9')).toMatchObject({ note: '', tags: [], favorite: false, url: '' });
  });
});

describe('helpers and selection', () => {
  it('sanitizes and detects user content', () => {
    expect(sanitizeMeta(null)).toBeNull();
    expect(sanitizeMeta([])).toBeNull();
    expect(sanitizeMeta({ note: 'x'.repeat(6000) }).note).toHaveLength(5000);
    expect(hasUserContent(sanitizeMeta({}))).toBe(false);
    expect(hasUserContent(sanitizeMeta({ tags: ['a'] }))).toBe(true);
    expect(hasUserContent(sanitizeMeta({ hidden: true }))).toBe(true);
  });

  it('persists only on live storage; Mock storage is marked non-persistent', () => {
    const live = { list: () => [], write: async () => {}, read: () => null };
    expect(selectMetaStore({ PortalCloud: live })).toMatchObject({ kind: 'cloud', persistent: true });
    expect(selectMetaStore({ PortalCloud: createMockStorage() })).toMatchObject({ kind: 'cloud', persistent: false });
    expect(selectMetaStore({})).toMatchObject({ kind: 'memory', persistent: false });
  });

  it('seeds demo categories for fixture records', () => {
    expect(selectMetaStore({ PortalCloud: createMockStorage() }).get('fixture:cxr542-portal')).toMatchObject({ category: '개인 서비스' });
  });
});

describe('repositories that disappeared from GitHub', () => {
  it('keeps notes for missing repos, ignores empty ones and fixture keys', async () => {
    const store = createCloudMetaStore(createMockStorage());
    await store.set('github:1', { note: 'present' });
    await store.set('github:2', { note: 'deleted repo', name: 'old' });
    await store.set('github:3', {});
    await store.set('fixture:demo', { note: 'sample' });
    const { findOrphans } = await import('../src/features/github-repos/metaStore.js');
    const orphans = findOrphans(store.storedKeys(), [{ key: 'github:1' }], store.all());
    expect(orphans.map(o => [o.key, o.name, o.note])).toEqual([['github:2', 'old', 'deleted repo']]);
  });

  it('a renamed repository keeps its note because the key is the repository id', async () => {
    const store = createCloudMetaStore(createMockStorage());
    await store.set('github:10', { note: 'survives rename', name: 'old-name' });
    const { findOrphans } = await import('../src/features/github-repos/metaStore.js');
    expect(findOrphans(store.storedKeys(), [{ key: 'github:10', name: 'new-name' }], store.all())).toEqual([]);
    expect(store.get('github:10').note).toBe('survives rename');
  });
});
