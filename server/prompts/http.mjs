import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function config(env = process.env) {
  const url = env.PROMPTS_SUPABASE_URL;
  const key = env.PROMPTS_SUPABASE_PUBLISHABLE_KEY;
  if (env.PROMPTS_ENABLED !== 'true' || !url || !key) throw new HttpError(503, 'not_configured');
  const local = env.PROMPTS_LOCAL_TEST === 'true' && env.NODE_ENV === 'test' && !env.VERCEL && /^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(url);
  const schema = env.PROMPTS_DB_SCHEMA || 'public';
  if (!['public', 'prompt_preview'].includes(schema) || (schema === 'prompt_preview' && !local && !(env.VERCEL === '1' && env.VERCEL_ENV === 'preview'))) {
    throw new HttpError(503, 'invalid_configuration');
  }
  if (local && key.startsWith('sb_publishable_')) return { url, key, schema };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || /^(sb_secret_|ey)/.test(key)) {
    throw new HttpError(503, 'invalid_configuration');
  }
  return { url, key, schema };
}

export async function body(req, maxBytes = 256 * 1024) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'json_required');
  if (Number(req.headers['content-length']) > maxBytes) throw new HttpError(413, 'request_too_large');
  let value = req.body;
  if (value === undefined) {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes) throw new HttpError(413, 'request_too_large');
      chunks.push(Buffer.from(chunk));
    }
    value = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') {
    if (Buffer.byteLength(value) > maxBytes) throw new HttpError(413, 'request_too_large');
    try { value = JSON.parse(value); } catch { throw new HttpError(400, 'invalid_json'); }
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new HttpError(400, 'invalid_body');
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) throw new HttpError(413, 'request_too_large');
  return value;
}

export async function upstream(path, { token, method = 'GET', data, fetcher = fetch, env } = {}) {
  const { url, key, schema } = config(env);
  let response;
  try {
    response = await fetcher(url + path, {
      method, headers: { apikey: key, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', ...(path.startsWith('/rest/v1/') ? { 'Accept-Profile': schema, 'Content-Profile': schema } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new HttpError(503, 'upstream_unavailable'); }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const known = { PT401: [401, 'unauthorized'], PT403: [403, 'forbidden'], PT404: [404, 'not_found'], PT409: [409, 'version_conflict'], PT410: [410, 'already_deleted'], PT429: [429, 'rate_limited'], PT400: [400, 'invalid_input'] };
    if (known[result?.code]) throw new HttpError(...known[result.code]);
    if (response.status === 429) throw new HttpError(429, 'rate_limited');
    if (path.startsWith('/auth/') && response.status === 400) throw new HttpError(401, 'unauthorized');
    if (response.status === 401 || response.status === 403) throw new HttpError(401, 'unauthorized');
    throw new HttpError(502, 'upstream_error');
  }
  return result;
}

export async function authenticate(req, deps = {}) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer [^\s]{20,8192}$/.test(header)) throw new HttpError(401, 'unauthorized');
  const token = header.slice(7);
  const user = await upstream('/auth/v1/user', { ...deps, token });
  if (!user?.id || user.is_anonymous || !user.email_confirmed_at) throw new HttpError(401, 'unauthorized');
  return { token, user };
}

export function endpoint(run, { methods, deps = {} }) {
  return async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Request-Id', requestId);
    let status = 200;
    try {
      if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); throw new HttpError(405, 'method_not_allowed'); }
      const result = await run(req, deps);
      if (result.redirect) {
        res.statusCode = 303; res.setHeader('Location', result.redirect); res.end(JSON.stringify({ redirect: result.redirect })); return;
      }
      status = result.status || 200;
      res.statusCode = status; res.end(JSON.stringify(result.body));
    } catch (err) {
      status = err instanceof HttpError ? err.status : 500;
      if (status === 429) res.setHeader('Retry-After', '60');
      if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
      res.statusCode = status;
      res.end(JSON.stringify({ error: { code: err instanceof HttpError ? err.code : 'internal_error', request_id: requestId } }));
    } finally {
      (deps.logger || console).info(JSON.stringify({ event: 'prompts_api', request_id: requestId, method: req.method, status }));
    }
  };
}
