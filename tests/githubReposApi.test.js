import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import entry from '../api/github-repos.mjs';
import { createGithubReposHandler } from '../server/github/reposApi.mjs';

const GH_TOKEN = 'github_pat_unit_synthetic_server_token';
const USER_TOKEN = 'portal-access-token-synthetic-0001';
const OWNER = 'owner-uuid-unit';
const ENV = {
  VERCEL_ENV: 'production',
  PORTAL_OWNER_USER_ID: OWNER,
  SUPABASE_URL: 'https://unit.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit',
  GITHUB_REPOS_TOKEN: GH_TOKEN,
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const repo = (id, over = {}) => ({ id, name: `r${id}`, full_name: `cxr542/r${id}`, fork: false, private: false, html_url: `https://github.com/cxr542/r${id}`, ...over });

function backend({ user = { id: OWNER }, userStatus = 200, github = {} } = {}) {
  const calls = [];
  const fetcher = vi.fn(async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} });
    if (url === 'https://unit.supabase.co/auth/v1/user') return userStatus === 200 ? json(user) : json({ msg: 'x' }, userStatus);
    const path = url.replace('https://api.github.com', '');
    const route = github[path];
    if (!route) return json({ message: 'Not Found' }, 404);
    return typeof route === 'function' ? route(init) : route.clone();
  });
  return { fetcher, calls, githubCalls: () => calls.filter(c => c.url.startsWith('https://api.github.com')) };
}

function request(url, { method = 'GET', auth = `Bearer ${USER_TOKEN}`, query } = {}) {
  return { method, url, headers: auth ? { authorization: auth } : {}, ...(query ? { query } : {}) };
}

function response() {
  return {
    headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value },
    end(raw) { this.raw = raw; this.body = JSON.parse(raw); },
  };
}

async function call(handlerOrEnv, req, be) {
  const handler = typeof handlerOrEnv === 'function' ? handlerOrEnv : createGithubReposHandler({ env: handlerOrEnv, fetcher: be.fetcher });
  const res = response();
  await handler(req, res);
  return res;
}

const LIST = '/user/repos?affiliation=owner&per_page=100&sort=pushed';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('deployment boundary', () => {
  it('rejects Mock Preview at the entry point with no network', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('PORTAL_DATA_MODE', 'mock');
    vi.stubEnv('GITHUB_REPOS_TOKEN', GH_TOKEN);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const res = response();
    await entry(request('/api/github-repos'), res);
    expect(res.statusCode).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...ENV, VERCEL_ENV: 'preview', PORTAL_DATA_MODE: 'supabase' }, 503, 'invalid_configuration'],
    [{ ...ENV, VERCEL_ENV: 'preview', PORTAL_DATA_MODE: 'mock' }, 403, 'mock_live_access_denied'],
  ])('also fails closed inside the handler: %o', async (env, status, error) => {
    const be = backend();
    const res = await call(env, request('/api/github-repos'), be);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ error });
    expect(be.fetcher).not.toHaveBeenCalled();
  });

  it('is routed before the SPA fallback', () => {
    const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const index = rewrites.findIndex(r => r.source === '/api/github-repos');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(rewrites.findIndex(r => r.source === '/(.*)'));
  });
});

describe('portal owner session', () => {
  it('requires a bearer token before any network call', async () => {
    const be = backend();
    const res = await call(ENV, request('/api/github-repos', { auth: null }), be);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'session_required' });
    expect(be.fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['another user', { user: { id: 'someone-else' } }],
    ['an anonymous user', { user: { id: OWNER, is_anonymous: true } }],
    ['an expired session', { userStatus: 401 }],
  ])('rejects %s without calling GitHub', async (_label, opts) => {
    const be = backend({ ...opts, github: { [LIST]: json([repo(1)]) } });
    const res = await call(ENV, request('/api/github-repos'), be);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'session_required' });
    expect(be.githubCalls()).toHaveLength(0);
  });

  it('checks the session with the publishable key and the caller token only', async () => {
    const be = backend({ github: { [LIST]: json([]) } });
    await call(ENV, request('/api/github-repos'), be);
    expect(be.calls[0]).toMatchObject({ url: 'https://unit.supabase.co/auth/v1/user', headers: { apikey: 'sb_publishable_unit', authorization: `Bearer ${USER_TOKEN}` } });
    expect(JSON.stringify(be.calls[0].headers)).not.toContain(GH_TOKEN);
  });

  it('reports missing owner configuration or Supabase outage as 503', async () => {
    const be = backend();
    expect((await call({ ...ENV, PORTAL_OWNER_USER_ID: '' }, request('/api/github-repos'), be)).body).toEqual({ error: 'not_configured' });
    expect(be.fetcher).not.toHaveBeenCalled();
    const down = { fetcher: vi.fn(() => Promise.reject(new TypeError('offline'))) };
    const res = await call(ENV, request('/api/github-repos'), down);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'network' });
  });
});

describe('repository resources', () => {
  it('lists normalized repositories without exposing the GitHub token', async () => {
    const be = backend({ github: { [LIST]: json([repo(1), repo(2, { fork: true, private: true })], 200, { 'x-ratelimit-remaining': '4999' }) } });
    const res = await call(ENV, request('/api/github-repos?resource=list'), be);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.repos.map(r => [r.key, r.fork, r.visibility])).toEqual([['github:1', false, 'public'], ['github:2', true, 'private']]);
    expect(res.body.rateLimit.remaining).toBe(4999);
    expect(be.githubCalls()[0].headers.Authorization).toBe(`Bearer ${GH_TOKEN}`);
    expect(res.raw).not.toContain(GH_TOKEN);
    expect(res.raw).not.toContain(USER_TOKEN);
  });

  it('requires the server GitHub token after the session check', async () => {
    const be = backend();
    const res = await call({ ...ENV, GITHUB_REPOS_TOKEN: '' }, request('/api/github-repos'), be);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'not_configured' });
    expect(be.githubCalls()).toHaveLength(0);
  });

  it('resolves README and branches by stable repository id', async () => {
    const be = backend({ github: {
      '/repositories/7': json(repo(7, { name: 'renamed', full_name: 'cxr542/renamed' })),
      '/repos/cxr542/renamed/readme': new Response('# Renamed', { status: 200 }),
      '/repos/cxr542/renamed/branches?per_page=100': json([{ name: 'main', protected: true }]),
    } });
    const handler = createGithubReposHandler({ env: ENV, fetcher: be.fetcher });
    const readme = await call(handler, request('/api/github-repos?resource=readme&id=7'), be);
    expect(readme.body).toEqual({ key: 'github:7', readme: { text: '# Renamed' } });
    const branches = await call(handler, request('/api/github-repos', { query: { resource: 'branches', id: '7' } }), be);
    expect(branches.body).toEqual({ key: 'github:7', items: [{ name: 'main', protected: true }] });
  });

  it('returns readme null when the repository has none', async () => {
    const be = backend({ github: { '/repositories/8': json(repo(8)) } });
    const res = await call(ENV, request('/api/github-repos?resource=readme&id=8'), be);
    expect(res.body).toEqual({ key: 'github:8', readme: null });
  });

  it('refuses repositories owned by another account', async () => {
    const be = backend({ github: { '/repositories/9': json(repo(9, { full_name: 'someone/other' })) } });
    const res = await call(ENV, request('/api/github-repos?resource=readme&id=9'), be);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
    expect(be.githubCalls().map(c => c.url)).toEqual(['https://api.github.com/repositories/9']);
  });

  it.each(['abc', '-1', '0', '1e3', '01', '9007199254740993', ''])('rejects id=%s before calling GitHub', async id => {
    const be = backend();
    const res = await call(ENV, request(`/api/github-repos?resource=readme&id=${encodeURIComponent(id)}`), be);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_id' });
    expect(be.githubCalls()).toHaveLength(0);
  });

  it('rejects unknown resources and non-GET methods', async () => {
    const be = backend();
    expect((await call(ENV, request('/api/github-repos?resource=admin'), be)).body).toEqual({ error: 'invalid_resource' });
    const post = await call(ENV, request('/api/github-repos', { method: 'POST' }), be);
    expect(post.statusCode).toBe(405);
    expect(post.headers.allow).toBe('GET');
    expect(be.fetcher).not.toHaveBeenCalled();
  });
});

describe('GitHub failures', () => {
  it('maps a rejected server token to 502 unauthorized', async () => {
    const be = backend({ github: { [LIST]: json({ message: 'Bad credentials' }, 401) } });
    const res = await call(ENV, request('/api/github-repos'), be);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('passes rate limits through with Retry-After and resetAt', async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const be = backend({ github: { [LIST]: json({ message: 'rate' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }) } });
    const res = await call(ENV, request('/api/github-repos'), be);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited', resetAt: new Date(reset * 1000).toISOString() });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(500);
  });

  it('reuses one client so ETag revalidation survives between requests', async () => {
    let first = true;
    const be = backend({ github: { [LIST]: init => {
      if (first) { first = false; return json([repo(1)], 200, { etag: '"v1"' }); }
      return new Response(null, { status: init.headers['If-None-Match'] === '"v1"' ? 304 : 500 });
    } } });
    const handler = createGithubReposHandler({ env: ENV, fetcher: be.fetcher });
    await call(handler, request('/api/github-repos'), be);
    const again = await call(handler, request('/api/github-repos'), be);
    expect(again.statusCode).toBe(200);
    expect(again.body.cached).toBe(true);
  });
});
