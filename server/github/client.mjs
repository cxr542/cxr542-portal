// Server-only GitHub REST client for the GitHub Repos workspace (Phase 2-1).
// - The token stays on the server: it is sent only to https://api.github.com and
//   never appears in return values or error messages.
// - Fails closed in Mock/invalid deployments before any network access.
// - Follows Link pagination only within the API origin, uses ETag conditional
//   requests (304 does not count against the rate limit), and maps failures to
//   RepoSourceError codes shared with the UI.
import { liveDataDenial } from '../portalMode.js';
import { PortalModeError } from '../portalDataMode.js';
import { classifyGithubResponse, RepoSourceError } from '../../src/features/github-repos/repoErrors.js';
import { normalizeGithubRepo } from '../../src/features/github-repos/repoModel.js';

const API_ORIGIN = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const DEFAULTS = { maxPages: 10, timeoutMs: 10_000, maxReadmeBytes: 512 * 1024, cacheEntries: 200 };

export function parseNextLink(header) {
  if (!header) return null;
  for (const part of String(header).split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return null;
}

function readRateLimit(headers) {
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const reset = Number(headers.get('x-ratelimit-reset'));
  return {
    remaining: Number.isFinite(remaining) && headers.has('x-ratelimit-remaining') ? remaining : null,
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
  };
}

function assertFullName(fullName) {
  if (typeof fullName !== 'string' || !FULL_NAME.test(fullName) || fullName.includes('..')) {
    throw new RepoSourceError('forbidden');
  }
}

export function createGithubClient({ token, env = process.env, fetcher = globalThis.fetch, userAgent = 'cxr542-portal', options = {} } = {}) {
  const denial = liveDataDenial(env);
  if (denial) throw new PortalModeError(denial.code);
  if (typeof token !== 'string' || token.length < 20 || /\s/.test(token)) throw new RepoSourceError('not_configured');

  const config = { ...DEFAULTS, ...options };
  const cache = new Map(); // url -> { etag, body, next }
  let rateLimit = { remaining: null, resetAt: null };

  const remember = (url, entry) => {
    cache.delete(url);
    cache.set(url, entry);
    while (cache.size > config.cacheEntries) cache.delete(cache.keys().next().value);
  };

  async function request(url, { accept = 'application/vnd.github+json', raw = false } = {}) {
    const target = new URL(url, API_ORIGIN);
    if (target.origin !== API_ORIGIN) throw new RepoSourceError('invalid_response');
    const key = `${accept} ${target.href}`;
    const cached = cache.get(key);
    const headers = {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent,
      'X-GitHub-Api-Version': API_VERSION,
    };
    if (cached?.etag) headers['If-None-Match'] = cached.etag;

    let response;
    try {
      // Renamed repositories answer 301 within api.github.com; fetch drops
      // Authorization on any cross-origin hop, and the final origin is checked.
      response = await fetcher(target.href, { headers, redirect: 'follow', signal: AbortSignal.timeout(config.timeoutMs) });
    } catch {
      throw new RepoSourceError('network');
    }
    if (response.url && new URL(response.url).origin !== API_ORIGIN) throw new RepoSourceError('invalid_response');
    rateLimit = readRateLimit(response.headers);
    if (response.status === 304 && cached) {
      remember(key, cached);
      return { body: cached.body, next: cached.next, cached: true };
    }
    if (response.status === 404 && raw) return { body: null, next: null, cached: false };
    const error = classifyGithubResponse(response.status, response.headers);
    if (error) throw error;

    let body;
    try {
      if (raw) {
        const declared = Number(response.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > config.maxReadmeBytes) throw new RepoSourceError('invalid_response');
        body = await response.text();
        if (Buffer.byteLength(body) > config.maxReadmeBytes) throw new RepoSourceError('invalid_response');
      } else {
        body = await response.json();
      }
    } catch (err) {
      throw err instanceof RepoSourceError ? err : new RepoSourceError('invalid_response');
    }
    const next = parseNextLink(response.headers.get('link'));
    const etag = response.headers.get('etag');
    if (etag) remember(key, { etag, body, next });
    return { body, next, cached: false };
  }

  async function paginate(path) {
    const items = [];
    let url = path;
    let allCached = true;
    for (let page = 0; url; page++) {
      if (page >= config.maxPages) throw new RepoSourceError('invalid_response');
      const { body, next, cached } = await request(url);
      if (!Array.isArray(body)) throw new RepoSourceError('invalid_response');
      items.push(...body);
      allCached &&= cached;
      url = next;
    }
    return { items, cached: allCached };
  }

  return {
    /** Repositories owned by the token's user, including private ones the token can read. */
    async listRepos() {
      const { items, cached } = await paginate('/user/repos?affiliation=owner&per_page=100&sort=pushed');
      const repos = [];
      for (const raw of items) {
        try { repos.push(normalizeGithubRepo(raw)); } catch { /* skip malformed item */ }
      }
      return { repos, cached, syncedAt: new Date().toISOString(), rateLimit: { ...rateLimit } };
    },

    /** Resolves a stable repository id to its current metadata (follows renames). */
    async getRepo(id) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new RepoSourceError('forbidden');
      const { body } = await request(`/repositories/${id}`);
      return normalizeGithubRepo(body);
    },

    /** Raw README text, or null when the repository has none. */
    async getReadme(fullName) {
      assertFullName(fullName);
      const { body } = await request(`/repos/${fullName}/readme`, { accept: 'application/vnd.github.raw+json', raw: true });
      return body == null ? null : { text: body };
    },

    async listBranches(fullName) {
      assertFullName(fullName);
      const { items } = await paginate(`/repos/${fullName}/branches?per_page=100`);
      return items
        .filter(branch => branch && typeof branch.name === 'string')
        .map(branch => ({ name: branch.name, protected: branch.protected === true }));
    },

    rateLimit: () => ({ ...rateLimit }),
  };
}
