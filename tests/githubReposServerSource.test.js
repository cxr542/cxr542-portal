import { describe, expect, it, vi } from 'vitest';
import { createFixtureRepoSource, createLiveRepoSource, createServerRepoSource, fixtureRepoRecords, RepoSourceError, selectRepoSource } from '../src/features/github-repos/repoSource.js';

const TOKEN = 'portal-access-token-synthetic-0001';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const record = (id, over = {}) => ({ key: `github:${id}`, id, name: `r${id}`, fullName: `cxr542/r${id}`, ...over });

describe('server repo source', () => {
  it('sends the portal session token to the same-origin API only', async () => {
    const fetcher = vi.fn(async () => json({ repos: [record(1)], syncedAt: '2026-11-24T00:00:00Z' }));
    const source = createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher });
    const result = await source.list();
    expect(fetcher).toHaveBeenCalledWith('/api/github-repos?resource=list', { cache: 'no-store', headers: { authorization: `Bearer ${TOKEN}` } });
    expect(result).toMatchObject({ verified: true, syncedAt: '2026-11-24T00:00:00Z', repos: [{ key: 'github:1' }] });
  });

  it.each([null, '', undefined])('requires a session token before any request: %s', async token => {
    const fetcher = vi.fn();
    await expect(createServerRepoSource({ getAccessToken: async () => token, fetcher }).list()).rejects.toMatchObject({ code: 'session_required' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('treats a throwing session getter as signed out', async () => {
    const fetcher = vi.fn();
    await expect(createServerRepoSource({ getAccessToken: () => { throw new Error('x'); }, fetcher }).list()).rejects.toMatchObject({ code: 'session_required' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [json({ error: 'rate_limited', resetAt: '2026-11-24T01:00:00Z' }, 429), 'rate_limited', '2026-11-24T01:00:00Z'],
    [json({ error: 'session_required' }, 401), 'session_required', null],
    [json({ error: 'not_configured' }, 503), 'not_configured', null],
    [json({ error: 'mock_live_access_denied' }, 403), 'forbidden', null],
    [new Response('<html>', { status: 502 }), 'network', null],
    [json({}, 418), 'unknown', null],
  ])('maps API failures to UI error codes', async (response, code, resetAt) => {
    const source = createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher: async () => response });
    await expect(source.list()).rejects.toMatchObject({ code, resetAt });
  });

  it('maps transport failures and malformed bodies', async () => {
    await expect(createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher: () => Promise.reject(new TypeError('offline')) }).list()).rejects.toMatchObject({ code: 'network' });
    await expect(createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher: async () => new Response('not json', { status: 200 }) }).list()).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher: async () => json({ repos: 'x' }) }).list()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('drops records that are not GitHub records', async () => {
    const source = createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher: async () => json({ repos: [record(1), { key: 'fixture:x', name: 'x' }, null, { key: 'github:2' }] }) });
    expect((await source.list()).repos.map(r => r.key)).toEqual(['github:1']);
  });

  it('requests README and branches by repository id', async () => {
    const fetcher = vi.fn(async url => (url.includes('readme') ? json({ key: 'github:5', readme: { text: '# Hi' } }) : json({ key: 'github:5', items: [{ name: 'main' }] })));
    const source = createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher });
    expect(await source.readme(record(5))).toEqual({ text: '# Hi' });
    expect(await source.branches(record(5))).toEqual({ items: [{ name: 'main' }] });
    expect(fetcher.mock.calls.map(c => c[0])).toEqual(['/api/github-repos?resource=readme&id=5', '/api/github-repos?resource=branches&id=5']);
  });

  it('returns null for a missing README and rejects records without an id', async () => {
    const fetcher = vi.fn(async () => json({ key: 'github:5', readme: null }));
    const source = createServerRepoSource({ getAccessToken: async () => TOKEN, fetcher });
    expect(await source.readme(record(5))).toBeNull();
    await expect(source.readme({ key: 'github:x', id: 'x' })).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('live source fallback', () => {
  it('shows fixture data with a notice until the server has a GitHub token', async () => {
    const server = { list: vi.fn(() => Promise.reject(new RepoSourceError('not_configured'))) };
    const result = await createLiveRepoSource({ server, fixture: createFixtureRepoSource() }).list();
    expect(result).toMatchObject({ verified: false, notice: 'not_configured' });
    expect(result.repos.every(r => r.key.startsWith('fixture:'))).toBe(true);
  });

  it.each(['session_required', 'rate_limited', 'network', 'unauthorized'])('does not hide a real %s failure behind sample data', async code => {
    const server = { list: () => Promise.reject(new RepoSourceError(code)) };
    await expect(createLiveRepoSource({ server, fixture: createFixtureRepoSource() }).list()).rejects.toMatchObject({ code });
  });

  it('routes detail requests by record key', async () => {
    const server = { readme: vi.fn(async () => ({ text: 'real' })), branches: vi.fn(async () => ({ items: [] })) };
    const live = createLiveRepoSource({ server, fixture: createFixtureRepoSource() });
    expect(await live.readme(record(1))).toEqual({ text: 'real' });
    expect(await live.readme(fixtureRepoRecords()[0])).toMatchObject({ sample: true });
    expect(server.readme).toHaveBeenCalledTimes(1);
  });
});

describe('runtime source selection', () => {
  const session = { mode: 'supabase', getAccessToken: async () => TOKEN };

  it('uses the server-backed live source with a portal session', () => {
    expect(selectRepoSource({ PortalSession: session, PortalCloud: {} }).kind).toBe('live');
  });

  it.each([
    ['Mock runtime, even with a session object', { PortalSession: session, PortalCloud: { mode: 'mock' } }],
    ['no session', { PortalCloud: {} }],
    ['session from another mode', { PortalSession: { ...session, mode: 'other' }, PortalCloud: {} }],
    ['session without a getter', { PortalSession: { mode: 'supabase' }, PortalCloud: {} }],
  ])('falls back to the fixture source: %s', (_label, globals) => {
    expect(selectRepoSource(globals).kind).toBe('fixture');
  });

  it('applies ?repoState only to the fixture source', async () => {
    await expect(selectRepoSource({}, '?repoState=unauthorized').list()).rejects.toMatchObject({ code: 'unauthorized' });
    const live = selectRepoSource({ PortalSession: session, PortalCloud: {} }, '?repoState=unauthorized');
    expect(live.kind).toBe('live');
  });
});
