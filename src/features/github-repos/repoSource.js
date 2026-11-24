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

export function createFixtureRepoSource({ now = () => new Date(), fail = null } = {}) {
  return {
    kind: 'fixture',
    verified: false,
    async list() {
      if (fail) throw new RepoSourceError(fail);
      return { repos: fixtureRepoRecords(), syncedAt: now().toISOString() };
    },
    async readme() {
      return null;
    },
  };
}

export function createFixtureMetaStore() {
  const meta = Object.fromEntries(SAMPLE_REPOS.map(repo => [`fixture:${repo.name}`, { category: repo.category, status: repo.status, tags: [], favorite: false, note: '', hidden: false }]));
  return {
    kind: 'fixture',
    persistent: false,
    get: key => meta[key] || null,
    all: () => ({ ...meta }),
  };
}
