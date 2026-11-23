import { describe, expect, it, vi } from 'vitest';
import { filterRepoViews, normalizeGithubRepo, originLabel, repoKey, sortRepoViews, toRepoView } from '../src/features/github-repos/repoModel';
import { classifyGithubResponse, createFixtureMetaStore, createFixtureRepoSource, fixtureRepoRecords, RepoSourceError } from '../src/features/github-repos/repoSource';

const rawRepo = (over = {}) => ({ id: 101, name: 'alpha', full_name: 'cxr542/alpha', description: 'Alpha', fork: false, private: false, visibility: 'public', archived: false, language: 'JavaScript', topics: ['ai'], stargazers_count: 3, default_branch: 'main', pushed_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z', html_url: 'https://github.com/cxr542/alpha', ...over });

describe('GitHub repository model', () => {
  it('normalizes the official REST fields and keys by stable repository id', () => {
    const repo = normalizeGithubRepo(rawRepo({ fork: true, private: true }));
    expect(repo).toMatchObject({ key: repoKey(101), fork: true, forkVerified: true, visibility: 'private', defaultBranch: 'main', topics: ['ai'] });
    expect(originLabel(repo)).toBe('Fork');
    expect(normalizeGithubRepo(rawRepo({ name: 'renamed' })).key).toBe(repo.key);
  });

  it('rejects malformed items and unsafe html_url values', () => {
    expect(() => normalizeGithubRepo({ name: 'x' })).toThrow('invalid_repository');
    expect(normalizeGithubRepo(rawRepo({ html_url: 'javascript:alert(1)' })).url).toBe('https://github.com/cxr542/alpha');
  });

  it('keeps user metadata separate and applies it per key', () => {
    const repo = normalizeGithubRepo(rawRepo());
    const view = toRepoView(repo, { category: 'AI·에이전트', tags: ['mcp'], favorite: true, note: 'keep' });
    expect(view).toMatchObject({ category: 'AI·에이전트', tags: ['mcp'], favorite: true, note: 'keep', origin: '직접 제작' });
    expect(repo).not.toHaveProperty('note');
    expect(toRepoView(repo, null)).toMatchObject({ category: '미분류', tags: [], favorite: false });
  });

  it('filters by origin, visibility, tags, and hides hidden repos', () => {
    const views = [
      toRepoView(normalizeGithubRepo(rawRepo()), { tags: ['portal'] }),
      toRepoView(normalizeGithubRepo(rawRepo({ id: 2, name: 'beta', fork: true, private: true })), {}),
      toRepoView(normalizeGithubRepo(rawRepo({ id: 3, name: 'gamma' })), { hidden: true }),
    ];
    expect(filterRepoViews(views, { origin: 'fork' }).map(r => r.name)).toEqual(['beta']);
    expect(filterRepoViews(views, { origin: 'own' }).map(r => r.name)).toEqual(['alpha']);
    expect(filterRepoViews(views, { visibility: 'private' }).map(r => r.name)).toEqual(['beta']);
    expect(filterRepoViews(views, { query: 'PORTAL' }).map(r => r.name)).toEqual(['alpha']);
    expect(filterRepoViews(views, { includeHidden: true })).toHaveLength(3);
  });

  it('sorts favorites first, then by the chosen key', () => {
    const views = [
      toRepoView(normalizeGithubRepo(rawRepo({ id: 1, name: 'b', pushed_at: '2026-01-01T00:00:00Z' })), {}),
      toRepoView(normalizeGithubRepo(rawRepo({ id: 2, name: 'a', pushed_at: '2026-02-01T00:00:00Z' })), {}),
      toRepoView(normalizeGithubRepo(rawRepo({ id: 3, name: 'c', pushed_at: '2025-01-01T00:00:00Z' })), { favorite: true }),
    ];
    expect(sortRepoViews(views, 'name').map(r => r.name)).toEqual(['c', 'a', 'b']);
    expect(sortRepoViews(views, 'pushed').map(r => r.name)).toEqual(['c', 'a', 'b']);
    expect(sortRepoViews(views.slice(0, 2), 'pushed').map(r => r.name)).toEqual(['a', 'b']);
  });
});

describe('fixture repository source', () => {
  it('returns unverified fixture records without any network access', async () => {
    const fetcher = vi.fn(() => { throw new TypeError('unexpected network'); });
    vi.stubGlobal('fetch', fetcher);
    const { repos, syncedAt } = await createFixtureRepoSource({ now: () => new Date('2026-11-23T00:00:00Z') }).list();
    expect(repos).toHaveLength(15);
    expect(repos.every(r => r.forkVerified === false && r.key.startsWith('fixture:'))).toBe(true);
    expect(syncedAt).toBe('2026-11-23T00:00:00.000Z');
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('labels fixture origin as an estimate and preserves the Phase 1 categories', () => {
    const meta = createFixtureMetaStore();
    const views = fixtureRepoRecords().map(r => toRepoView(r, meta.get(r.key)));
    expect(filterRepoViews(views, { category: 'AI·에이전트', origin: 'fork' }).map(r => r.name)).toEqual(['agent-browser', 'openbot']);
    expect(new Set(views.map(v => v.origin))).toEqual(new Set(['직접 제작 추정', '외부 원본 추정']));
    expect(meta.persistent).toBe(false);
  });

  it('surfaces typed errors for UI states', async () => {
    await expect(createFixtureRepoSource({ fail: 'rate_limited' }).list()).rejects.toBeInstanceOf(RepoSourceError);
    expect(new RepoSourceError('bogus').code).toBe('unknown');
  });
});

describe('GitHub response classification', () => {
  it.each([
    [200, {}, null],
    [401, {}, 'unauthorized'],
    [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1795000000' }, 'rate_limited'],
    [429, { 'retry-after': '60' }, 'rate_limited'],
    [403, { 'x-ratelimit-remaining': '42' }, 'forbidden'],
    [404, {}, 'forbidden'],
    [502, {}, 'network'],
    [422, {}, 'unknown'],
  ])('status %s → %s', (status, headers, code) => {
    const result = classifyGithubResponse(status, headers);
    expect(result?.code ?? null).toBe(code);
  });

  it('reads a Fetch Headers object and exposes the reset time', () => {
    const err = classifyGithubResponse(403, new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1795000000' }));
    expect(err.resetAt).toBe(new Date(1795000000 * 1000).toISOString());
  });
});
