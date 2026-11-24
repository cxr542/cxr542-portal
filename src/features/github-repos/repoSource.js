// Data-access boundary for the GitHub Repos workspace.
// A RepoSource only reads GitHub metadata; a UserMetaStore only holds user data.
// The UI depends on these interfaces, so Phase 2 can add a server-proxied GitHub
// source and Phase 3 a persistent meta store without changing the page.
//
// RepoSource:     { kind, verified, list(): Promise<{ repos: RepoRecord[], syncedAt: string }>, readme(key): Promise<{ text, url } | null> }
// UserMetaStore:  { kind, persistent, get(key): UserMeta | null, all(): Record<key, UserMeta> }
import { SAMPLE_REPOS } from './githubReposData';

export { classifyGithubResponse, RepoSourceError, SOURCE_ERRORS } from './repoErrors.js';
import { RepoSourceError, SOURCE_ERRORS } from './repoErrors.js';
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

/** Demo categories/status for fixture records; never written to storage unless the user edits them. */
export function fixtureMetaDefaults() {
  return Object.fromEntries(SAMPLE_REPOS.map(repo => [`fixture:${repo.name}`, { category: repo.category, status: repo.status, tags: [], favorite: false, note: '', hidden: false }]));
}

export function createFixtureMetaStore() {
  return createMemoryMetaStore(fixtureMetaDefaults());
}

const STATUS_CODES = { 401: 'session_required', 403: 'forbidden', 429: 'rate_limited', 502: 'network', 503: 'not_configured' };

/** Browser source backed by the owner-only /api/github-repos proxy. The GitHub token stays on the server. */
export function createServerRepoSource({ getAccessToken, fetcher = (...args) => globalThis.fetch(...args), endpoint = '/api/github-repos' } = {}) {
  async function request(params) {
    let token;
    try { token = await getAccessToken?.(); } catch { token = null; }
    if (typeof token !== 'string' || !token) throw new RepoSourceError('session_required');
    let response;
    try {
      response = await fetcher(`${endpoint}?${new URLSearchParams(params)}`, { cache: 'no-store', headers: { authorization: `Bearer ${token}` } });
    } catch {
      throw new RepoSourceError('network');
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const code = typeof body?.error === 'string' && Object.hasOwn(SOURCE_ERRORS, body.error) ? body.error : STATUS_CODES[response.status] || 'unknown';
      throw new RepoSourceError(code, { resetAt: typeof body?.resetAt === 'string' ? body.resetAt : null });
    }
    if (!body || typeof body !== 'object') throw new RepoSourceError('invalid_response');
    return body;
  }
  const idOf = repo => {
    if (!Number.isSafeInteger(repo?.id) || repo.id <= 0) throw new RepoSourceError('invalid_response');
    return String(repo.id);
  };
  return {
    kind: 'server',
    verified: true,
    async list() {
      const body = await request({ resource: 'list' });
      if (!Array.isArray(body.repos)) throw new RepoSourceError('invalid_response');
      const repos = body.repos.filter(repo => repo && typeof repo.key === 'string' && repo.key.startsWith('github:') && typeof repo.name === 'string');
      return { repos, syncedAt: body.syncedAt || new Date().toISOString(), verified: true, rateLimit: body.rateLimit || null };
    },
    async readme(repo) {
      const body = await request({ resource: 'readme', id: idOf(repo) });
      return body.readme && typeof body.readme.text === 'string' ? { text: body.readme.text } : null;
    },
    async branches(repo) {
      const body = await request({ resource: 'branches', id: idOf(repo) });
      return { items: Array.isArray(body.items) ? body.items : [] };
    },
  };
}

/**
 * Live source: real GitHub data through the server. Until the server has a GitHub
 * token (not_configured), it shows the fixture data and says so, instead of an error.
 * Detail requests follow the record's key prefix, so each record uses its own source.
 */
export function createLiveRepoSource({ server, fixture }) {
  const pick = repo => (String(repo?.key).startsWith('github:') ? server : fixture);
  return {
    kind: 'live',
    verified: true,
    async list() {
      try {
        return await server.list();
      } catch (error) {
        if (error?.code !== 'not_configured') throw error;
        const result = await fixture.list();
        return { ...result, verified: false, notice: 'not_configured' };
      }
    },
    readme: repo => pick(repo).readme(repo),
    branches: repo => pick(repo).branches(repo),
  };
}

/**
 * Chooses the page's source from the runtime globals. Mock runtimes, or any
 * runtime without a portal session, always get the fixture source.
 */
export function selectRepoSource(globals = globalThis, search = '') {
  const session = globals.PortalSession;
  if (globals.PortalCloud?.mode !== 'mock' && session?.mode === 'supabase' && typeof session.getAccessToken === 'function') {
    return createLiveRepoSource({
      server: createServerRepoSource({ getAccessToken: () => session.getAccessToken() }),
      fixture: createFixtureRepoSource(),
    });
  }
  return createFixtureRepoSource({ state: demoStateFromSearch(search), delayMs: 300 });
}
