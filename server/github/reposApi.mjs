// GET /api/github-repos?resource=list|readme|branches[&id=<repository id>]
// Owner-only proxy to the GitHub REST client (Phase 2-2).
// 1. Mock/invalid deployments are rejected before anything else.
// 2. The caller must present the portal owner's Supabase access token.
// 3. Only then is the server-held GitHub token used; it never reaches the browser.
import { liveDataDenial, serverEnvironment } from '../portalMode.js';
import { resolveSupabaseTarget } from '../supabaseTarget.js';
import { RepoSourceError } from '../../src/features/github-repos/repoErrors.js';
import { createGithubClient } from './client.mjs';

const ERROR_STATUS = {
  session_required: 401,
  unauthorized: 502, // the server's GitHub token was rejected
  forbidden: 403,
  rate_limited: 429,
  not_configured: 503,
  network: 502,
  invalid_response: 502,
  unknown: 500,
};
const RESOURCES = new Set(['list', 'readme', 'branches']);
const OWNER_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

class ApiError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function readQuery(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length) return req.query;
  try { return Object.fromEntries(new URL(req.url || '/', 'http://local').searchParams); } catch { return {}; }
}

/** Verifies the bearer token against the portal Supabase project and requires the configured owner. */
export async function verifyPortalOwner(req, { env, fetcher }) {
  const ownerId = env.PORTAL_OWNER_USER_ID;
  if (!ownerId) throw new ApiError(503, 'not_configured');
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !/^Bearer [^\s]{20,8192}$/.test(header)) throw new ApiError(401, 'session_required');
  let target;
  try { target = resolveSupabaseTarget(serverEnvironment(env), env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY); }
  catch { throw new ApiError(503, 'not_configured'); }
  let response;
  try {
    response = await fetcher(`${target.url}/auth/v1/user`, {
      headers: { apikey: target.key, authorization: header },
      signal: AbortSignal.timeout(8_000),
    });
  } catch { throw new ApiError(503, 'network'); }
  if (response.status === 401 || response.status === 403 || response.status === 400) throw new ApiError(401, 'session_required');
  if (!response.ok) throw new ApiError(503, 'network');
  const user = await response.json().catch(() => null);
  if (!user?.id || user.id !== ownerId || user.is_anonymous) throw new ApiError(401, 'session_required');
  return user;
}

export function createGithubReposHandler({ env = process.env, fetcher = globalThis.fetch, clientFactory = createGithubClient } = {}) {
  let client = null;
  let clientToken = null;
  const github = () => {
    // Reuse one client per token so its ETag cache survives warm invocations.
    if (!client || clientToken !== env.GITHUB_REPOS_TOKEN) {
      clientToken = env.GITHUB_REPOS_TOKEN;
      client = clientFactory({ token: clientToken, env, fetcher });
    }
    return client;
  };

  return async function githubReposHandler(req, res) {
    try {
      const denial = liveDataDenial(env);
      if (denial) throw new ApiError(denial.status, denial.code);
      if (req.method !== 'GET') throw new ApiError(405, 'method_not_allowed', { headers: { Allow: 'GET' } });
      const query = readQuery(req);
      const resource = String(query.resource || 'list');
      if (!RESOURCES.has(resource)) throw new ApiError(400, 'invalid_resource');
      const ownerLogin = env.GITHUB_REPOS_OWNER || 'cxr542';
      if (!OWNER_LOGIN.test(ownerLogin)) throw new ApiError(503, 'not_configured');

      await verifyPortalOwner(req, { env, fetcher });
      if (!env.GITHUB_REPOS_TOKEN) throw new ApiError(503, 'not_configured');
      const gh = github();

      if (resource === 'list') {
        const result = await gh.listRepos();
        return send(res, 200, { repos: result.repos, syncedAt: result.syncedAt, cached: result.cached, rateLimit: result.rateLimit });
      }

      const id = Number(query.id);
      if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== String(query.id)) throw new ApiError(400, 'invalid_id');
      const repo = await gh.getRepo(id);
      // Only repositories owned by the configured account, even though the token could read others.
      if (repo.fullName.split('/')[0].toLowerCase() !== ownerLogin.toLowerCase()) throw new RepoSourceError('forbidden');
      if (resource === 'readme') return send(res, 200, { key: repo.key, readme: await gh.getReadme(repo.fullName) });
      return send(res, 200, { key: repo.key, items: await gh.listBranches(repo.fullName) });
    } catch (error) {
      if (error instanceof ApiError) return send(res, error.status, { error: error.code }, error.extra.headers || {});
      if (error instanceof RepoSourceError) {
        const status = ERROR_STATUS[error.code] || 500;
        const headers = {};
        if (error.code === 'rate_limited' && error.resetAt) {
          headers['Retry-After'] = String(Math.max(1, Math.ceil((Date.parse(error.resetAt) - Date.now()) / 1000)));
        }
        return send(res, status, { error: error.code, ...(error.resetAt ? { resetAt: error.resetAt } : {}) }, headers);
      }
      if (error?.name === 'PortalModeError') return send(res, error.code === 'mock_live_access_denied' ? 403 : 503, { error: error.code });
      return send(res, 500, { error: 'unknown' });
    }
  };
}
