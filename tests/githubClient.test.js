import { describe, expect, it, vi } from 'vitest';
import { createGithubClient, parseNextLink } from '../server/github/client.mjs';

const TOKEN = 'github_pat_unit_synthetic_token_0000';
const LIVE_ENV = { VERCEL_ENV: 'production' };
const repo = (id, over = {}) => ({ id, name: `repo-${id}`, full_name: `cxr542/repo-${id}`, fork: false, private: false, html_url: `https://github.com/cxr542/repo-${id}`, ...over });
const json = (body, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function fakeGithub(routes) {
  const calls = [];
  const fetcher = vi.fn(async (url, init) => {
    calls.push({ url, headers: init.headers });
    const path = url.replace('https://api.github.com', '');
    const route = routes[path];
    if (!route) return json({ message: 'Not Found' }, { status: 404 });
    return typeof route === 'function' ? route(init) : route.clone();
  });
  return { fetcher, calls };
}

const client = (fetcher, extra = {}) => createGithubClient({ token: TOKEN, env: LIVE_ENV, fetcher, ...extra });

describe('GitHub client boundaries', () => {
  it.each([
    [{ VERCEL_ENV: 'preview', PORTAL_DATA_MODE: 'mock' }, 'mock_live_access_denied'],
    [{ VERCEL_ENV: 'preview' }, 'invalid_configuration'],
    [{ VERCEL: '1' }, 'invalid_configuration'],
  ])('refuses to exist in Mock or invalid deployments: %o', (env, code) => {
    const fetcher = vi.fn();
    expect(() => createGithubClient({ token: TOKEN, env, fetcher })).toThrow(expect.objectContaining({ code }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'short', 'has space token value 12345'])('requires a plausible token: %s', token => {
    expect(() => createGithubClient({ token, env: LIVE_ENV, fetcher: vi.fn() })).toThrow(expect.objectContaining({ code: 'not_configured' }));
  });

  it('sends the token only to api.github.com with versioned headers', async () => {
    const { fetcher, calls } = fakeGithub({ '/user/repos?affiliation=owner&per_page=100&sort=pushed': json([repo(1)]) });
    await client(fetcher).listRepos();
    expect(calls).toHaveLength(1);
    expect(calls[0].url.startsWith('https://api.github.com/')).toBe(true);
    expect(calls[0].headers).toMatchObject({ Authorization: `Bearer ${TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', Accept: 'application/vnd.github+json' });
  });

  it('never leaks the token through results or errors', async () => {
    const { fetcher } = fakeGithub({ '/user/repos?affiliation=owner&per_page=100&sort=pushed': json({ message: 'Bad credentials' }, { status: 401 }) });
    const error = await client(fetcher).listRepos().catch(err => err);
    expect(error).toMatchObject({ name: 'RepoSourceError', code: 'unauthorized' });
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(TOKEN);
  });
});

describe('repository listing', () => {
  it('follows Link pagination and normalizes with official fork metadata', async () => {
    const { fetcher, calls } = fakeGithub({
      '/user/repos?affiliation=owner&per_page=100&sort=pushed': json([repo(1), repo(2, { fork: true })], { headers: { link: '<https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=pushed&page=2>; rel="next", <https://api.github.com/user/repos?page=2>; rel="last"' } }),
      '/user/repos?affiliation=owner&per_page=100&sort=pushed&page=2': json([repo(3, { private: true }), { broken: true }], { headers: { 'x-ratelimit-remaining': '4990', 'x-ratelimit-reset': '1795000000' } }),
    });
    const result = await client(fetcher).listRepos();
    expect(calls).toHaveLength(2);
    expect(result.repos.map(r => [r.key, r.fork, r.visibility])).toEqual([['github:1', false, 'public'], ['github:2', true, 'public'], ['github:3', false, 'private']]);
    expect(result.rateLimit).toEqual({ remaining: 4990, resetAt: new Date(1795000000 * 1000).toISOString() });
  });

  it('refuses a next link that leaves the API origin', async () => {
    const { fetcher, calls } = fakeGithub({
      '/user/repos?affiliation=owner&per_page=100&sort=pushed': json([repo(1)], { headers: { link: '<https://evil.example/steal>; rel="next"' } }),
    });
    await expect(client(fetcher).listRepos()).rejects.toMatchObject({ code: 'invalid_response' });
    expect(calls).toHaveLength(1);
  });

  it('stops at the page limit instead of looping forever', async () => {
    const loop = json([repo(1)], { headers: { link: '<https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=pushed>; rel="next"' } });
    const { fetcher } = fakeGithub({ '/user/repos?affiliation=owner&per_page=100&sort=pushed': loop });
    await expect(client(fetcher, { options: { maxPages: 3 } }).listRepos()).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('revalidates with ETag and serves 304 from cache', async () => {
    let first = true;
    const { fetcher, calls } = fakeGithub({
      '/user/repos?affiliation=owner&per_page=100&sort=pushed': init => {
        if (first) { first = false; return json([repo(7)], { headers: { etag: 'W/"abc"' } }); }
        return new Response(null, { status: init.headers['If-None-Match'] === 'W/"abc"' ? 304 : 500 });
      },
    });
    const github = client(fetcher);
    expect((await github.listRepos()).cached).toBe(false);
    const again = await github.listRepos();
    expect(calls[1].headers['If-None-Match']).toBe('W/"abc"');
    expect(again).toMatchObject({ cached: true, repos: [{ key: 'github:7' }] });
  });

  it.each([
    [{ status: 401 }, 'unauthorized'],
    [{ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1795000000' } }, 'rate_limited'],
    [{ status: 429, headers: { 'retry-after': '30' } }, 'rate_limited'],
    [{ status: 403 }, 'forbidden'],
    [{ status: 503 }, 'network'],
  ])('maps %o to %s', async (init, code) => {
    const { fetcher } = fakeGithub({ '/user/repos?affiliation=owner&per_page=100&sort=pushed': json({ message: 'x' }, init) });
    await expect(client(fetcher).listRepos()).rejects.toMatchObject({ code });
  });

  it('maps transport failures and non-array bodies', async () => {
    await expect(client(vi.fn(() => Promise.reject(new TypeError('fetch failed')))).listRepos()).rejects.toMatchObject({ code: 'network' });
    const { fetcher } = fakeGithub({ '/user/repos?affiliation=owner&per_page=100&sort=pushed': json({ not: 'a list' }) });
    await expect(client(fetcher).listRepos()).rejects.toMatchObject({ code: 'invalid_response' });
    const html = vi.fn(async () => new Response('<html>', { status: 200 }));
    await expect(client(html).listRepos()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects a response that was redirected off the API origin', async () => {
    const redirected = json([repo(1)]);
    Object.defineProperty(redirected, 'url', { value: 'https://evil.example/user/repos' });
    await expect(client(vi.fn(async () => redirected)).listRepos()).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('repository details', () => {
  it('resolves a stable id to current metadata', async () => {
    const { fetcher } = fakeGithub({ '/repositories/42': json(repo(42, { name: 'renamed', full_name: 'cxr542/renamed' })) });
    expect(await client(fetcher).getRepo(42)).toMatchObject({ key: 'github:42', fullName: 'cxr542/renamed' });
    await expect(client(fetcher).getRepo(-1)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('returns raw README text, or null when missing', async () => {
    const { fetcher, calls } = fakeGithub({ '/repos/cxr542/alpha/readme': new Response('# Alpha', { status: 200 }) });
    const github = client(fetcher);
    expect(await github.getReadme('cxr542/alpha')).toEqual({ text: '# Alpha' });
    expect(calls[0].headers.Accept).toBe('application/vnd.github.raw+json');
    expect(await github.getReadme('cxr542/missing')).toBeNull();
  });

  it('caps README size', async () => {
    const { fetcher } = fakeGithub({ '/repos/cxr542/big/readme': new Response('x'.repeat(2048), { status: 200 }) });
    await expect(client(fetcher, { options: { maxReadmeBytes: 1024 } }).getReadme('cxr542/big')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it.each(['../../user', 'cxr542/../admin', 'cxr542', 'https://evil.example/x', 'a/b/c', 'cxr542/a?x=1'])('rejects unsafe repository names without a request: %s', async name => {
    const fetcher = vi.fn();
    const github = client(fetcher);
    await expect(github.getReadme(name)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(github.listBranches(name)).rejects.toMatchObject({ code: 'forbidden' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('lists branches across pages', async () => {
    const { fetcher } = fakeGithub({
      '/repos/cxr542/alpha/branches?per_page=100': json([{ name: 'main', protected: true }], { headers: { link: '<https://api.github.com/repos/cxr542/alpha/branches?per_page=100&page=2>; rel="next"' } }),
      '/repos/cxr542/alpha/branches?per_page=100&page=2': json([{ name: 'feat/x' }, { bogus: 1 }]),
    });
    expect(await client(fetcher).listBranches('cxr542/alpha')).toEqual([{ name: 'main', protected: true }, { name: 'feat/x', protected: false }]);
  });
});

describe('parseNextLink', () => {
  it('extracts rel=next only', () => {
    expect(parseNextLink('<https://api.github.com/a?page=2>; rel="next", <https://api.github.com/a?page=9>; rel="last"')).toBe('https://api.github.com/a?page=2');
    expect(parseNextLink('<https://api.github.com/a?page=1>; rel="prev"')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});
