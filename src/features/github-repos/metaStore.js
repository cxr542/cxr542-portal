// Persistent UserMetaStore on the portal's existing document storage (Phase 3).
// - Namespace `github-repos/meta`, one document per repository key (`github:<id>`).
//   portal_documents already enforces owner-only RLS and revision checks, so no
//   schema, RLS, or Auth change is needed.
// - GitHub metadata is never stored here and sync never writes here, so a
//   refresh, rename, or lost access cannot erase user data.
// - Writes are optimistic; a failed write stays queued in the portal's existing
//   failure/retry toolbar and the returned promise rejects so the UI can say so.
import { EMPTY_META, normalizeTags } from './repoModel.js';
import { createMemoryMetaStore, fixtureMetaDefaults } from './repoSource.js';

export const META_NAMESPACE = 'github-repos/meta';
const KEY = /^(github:\d{1,20}|fixture:[A-Za-z0-9._-]{1,100})$/;
const NOTE_LIMIT = 5000;

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/** Coerces a stored document into a safe UserMeta (stored data may be old or hand-edited). */
export function sanitizeMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    category: text(value.category, 50),
    status: text(value.status, 50),
    tags: normalizeTags(value.tags),
    favorite: value.favorite === true,
    note: text(value.note, NOTE_LIMIT),
    hidden: value.hidden === true,
    name: text(value.name, 100),
    url: typeof value.url === 'string' && value.url.startsWith('https://github.com/') ? value.url.slice(0, 300) : '',
    updatedAt: text(value.updatedAt, 40),
  };
}

/** True when a meta record carries anything the user would miss if it were dropped. */
export function hasUserContent(meta) {
  return Boolean(meta && (meta.note || meta.tags?.length || meta.favorite || meta.category || meta.status || meta.hidden));
}

/** Stored GitHub notes whose repository is no longer in the synced list (deleted or access lost). */
export function findOrphans(storedKeys, repos, meta) {
  const present = new Set(repos.map(repo => repo.key));
  return storedKeys
    .filter(key => key.startsWith('github:') && !present.has(key) && hasUserContent(meta[key]))
    .map(key => ({ key, ...meta[key] }));
}

export function createCloudMetaStore(cloud, { defaults = {}, persistent = true, namespace = META_NAMESPACE, now = () => new Date() } = {}) {
  const listeners = new Set();
  const local = new Map(); // optimistic values not yet confirmed by storage
  let snapshot = null;

  const notify = () => { snapshot = null; for (const listener of listeners) listener(); };
  const stored = () => {
    const out = {};
    for (const raw of cloud.list(namespace)) {
      if (!raw || !KEY.test(raw.key)) continue;
      const meta = sanitizeMeta(raw);
      if (meta) out[raw.key] = meta;
    }
    for (const [key, value] of local) {
      if (value === null) delete out[key];
      else out[key] = value;
    }
    return out;
  };

  const all = () => {
    if (!snapshot) snapshot = { ...defaults, ...stored() };
    return snapshot;
  };

  return {
    kind: 'cloud',
    persistent,
    namespace,
    all,
    get: key => all()[key] || null,
    /** Keys stored by the user (excludes defaults), used to find repositories that disappeared. */
    storedKeys: () => Object.keys(stored()),
    async set(key, patch) {
      if (!KEY.test(key)) throw new TypeError('invalid_repository_key');
      const current = all()[key] || EMPTY_META;
      const next = sanitizeMeta({ ...EMPTY_META, ...current, ...patch, updatedAt: now().toISOString() });
      local.set(key, next);
      notify();
      try {
        await cloud.write(namespace, key, { key, ...next });
        if (local.get(key) === next) local.delete(key);
        notify();
        return next;
      } catch (error) {
        // Keep the optimistic value: the portal's retry toolbar holds the same write.
        throw error instanceof Error ? error : new Error('save_failed');
      }
    },
    async remove(key) {
      if (!KEY.test(key)) throw new TypeError('invalid_repository_key');
      local.set(key, null);
      notify();
      await cloud.write(namespace, key, null);
      if (local.get(key) === null) local.delete(key);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Picks the meta store for the page: portal storage when present, otherwise memory. */
export function selectMetaStore(globals = globalThis) {
  const cloud = globals.PortalCloud;
  if (cloud && typeof cloud.list === 'function' && typeof cloud.write === 'function') {
    return createCloudMetaStore(cloud, { defaults: fixtureMetaDefaults(), persistent: cloud.mode !== 'mock' });
  }
  return createMemoryMetaStore(fixtureMetaDefaults());
}
