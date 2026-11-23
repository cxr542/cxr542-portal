// Data-access boundary for the GitHub Repos workspace.
// A RepoSource only reads GitHub metadata; a UserMetaStore only holds user data.
// The UI depends on these interfaces, so Phase 2 can add a server-proxied GitHub
// source and Phase 3 a persistent meta store without changing the page.
//
// RepoSource:     { kind, verified, list(): Promise<{ repos: RepoRecord[], syncedAt: string }>, readme(key): Promise<{ text, url } | null> }
// UserMetaStore:  { kind, persistent, get(key): UserMeta | null, all(): Record<key, UserMeta> }
import { SAMPLE_REPOS } from './githubReposData';

export const SOURCE_ERRORS = {
  unauthorized: 'GitHub 인증이 필요하거나 만료되었습니다.',
  forbidden: '이 저장소 목록을 볼 권한이 없습니다.',
  rate_limited: 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
  not_configured: 'GitHub 연동이 아직 설정되지 않았습니다.',
  network: 'GitHub에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.',
  invalid_response: 'GitHub 응답을 해석하지 못했습니다.',
  unknown: '저장소 목록을 불러오지 못했습니다.',
};

export class RepoSourceError extends Error {
  constructor(code, { resetAt = null } = {}) {
    super(code);
    this.name = 'RepoSourceError';
    this.code = Object.hasOwn(SOURCE_ERRORS, code) ? code : 'unknown';
    this.resetAt = resetAt;
  }
}

/** Phase 2 helper: maps a GitHub REST response status/headers to a RepoSourceError code (null when OK). */
export function classifyGithubResponse(status, headers = {}) {
  const header = name => (typeof headers.get === 'function' ? headers.get(name) : headers[name]) ?? null;
  if (status >= 200 && status < 300) return null;
  if (status === 401) return new RepoSourceError('unauthorized');
  if (status === 429 || (status === 403 && (header('x-ratelimit-remaining') === '0' || header('retry-after')))) {
    const reset = Number(header('x-ratelimit-reset'));
    return new RepoSourceError('rate_limited', { resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null });
  }
  if (status === 403 || status === 404) return new RepoSourceError('forbidden');
  return new RepoSourceError(status >= 500 ? 'network' : 'unknown');
}

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
