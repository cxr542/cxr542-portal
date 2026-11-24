// Data-access boundary for the GitHub Repos workspace.
// A RepoSource only reads GitHub metadata; a UserMetaStore only holds user data.
// The UI depends on these interfaces, so Phase 2 can add a server-proxied GitHub
// source and Phase 3 a persistent meta store without changing the page.
//
// RepoSource:     { kind, verified, list(): Promise<{ repos: RepoRecord[], syncedAt: string }>, readme(key): Promise<{ text, url } | null> }
// UserMetaStore:  { kind, persistent, get(key): UserMeta | null, all(): Record<key, UserMeta> }
import { SAMPLE_REPOS } from './githubReposData';

export { classifyGithubResponse, RepoSourceError, SOURCE_ERRORS } from './repoErrors.js';
import { RepoSourceError } from './repoErrors.js';
import { EMPTY_META, normalizeTags } from './repoModel.js';

/** Demo-only records: no network, credentials, or persistence. Origin values are estimates. */
export function fixtureRepoRecords() {
  return SAMPLE_REPOS.map(repo => ({
    key: `fixture:${repo.name}`,
    id: null,
    name: repo.name,
    fullName: `cxr542/${repo.name}`,
    description: repo.description,
    fork: repo.origin !== '직접 제작 추정',
    forkVerified: false,
    visibility: 'public',
    archived: false,
    language: repo.language,
    topics: [],
    stars: 0,
    defaultBranch: '',
    pushedAt: null,
    updatedAt: null,
    url: repo.url,
  }));
}

/** Demo states selectable with `?repoState=` while the fixture source is active (QA only). */
export const DEMO_STATES = ['loading', 'empty', 'unauthorized', 'forbidden', 'rate_limited', 'network', 'readme_missing'];

export function demoStateFromSearch(search = '') {
  const value = new URLSearchParams(search).get('repoState');
  return DEMO_STATES.includes(value) ? value : null;
}

const sampleReadme = repo => `# ${repo.name}

${repo.description}

## 주요 내용

- 기술: \`${repo.language || '미정'}\`
- 저장소: [${repo.fullName}](${repo.url})

\`\`\`sh
git clone ${repo.url}.git
\`\`\`
`;

export function createFixtureRepoSource({ now = () => new Date(), state = null, delayMs = 0 } = {}) {
  const wait = () => new Promise(resolve => setTimeout(resolve, delayMs));
  const errorState = ['unauthorized', 'forbidden', 'rate_limited', 'network'].includes(state) ? state : null;
  return {
    kind: 'fixture',
    verified: false,
    async list() {
      if (state === 'loading') return new Promise(() => {});
      if (delayMs) await wait();
      if (errorState) {
        throw new RepoSourceError(errorState, errorState === 'rate_limited' ? { resetAt: new Date(now().getTime() + 15 * 60_000).toISOString() } : {});
      }
      return { repos: state === 'empty' ? [] : fixtureRepoRecords(), syncedAt: now().toISOString() };
    },
    async readme(repo) {
      if (delayMs) await wait();
      if (state === 'readme_missing') return null;
      return { text: sampleReadme(repo), sample: true };
    },
    async branches() {
      if (delayMs) await wait();
      return { items: [{ name: 'main', protected: false }], sample: true };
    },
  };
}

/** In-memory UserMetaStore. Phase 3 replaces it with a persistent store of the same shape. */
export function createMemoryMetaStore(initial = {}) {
  let meta = structuredClone(initial);
  const listeners = new Set();
  return {
    kind: 'memory',
    persistent: false,
    get: key => meta[key] || null,
    all: () => meta,
    set(key, patch) {
      const next = { ...EMPTY_META, ...(meta[key] || {}), ...patch, updatedAt: new Date().toISOString() };
      next.tags = normalizeTags(next.tags);
      next.note = String(next.note || '').slice(0, 5000);
      meta = { ...meta, [key]: next };
      for (const listener of listeners) listener();
      return Promise.resolve(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createFixtureMetaStore() {
  return createMemoryMetaStore(Object.fromEntries(SAMPLE_REPOS.map(repo => [`fixture:${repo.name}`, { category: repo.category, status: repo.status, tags: [], favorite: false, note: '', hidden: false }])));
}
