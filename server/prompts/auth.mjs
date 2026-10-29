import { authenticate, body, config, endpoint, HttpError, upstream } from './http.mjs';

export function createAuthHandler(deps = {}) {
  return endpoint(async req => {
    const action = req.query?.action || new URL(req.url, 'https://portal.invalid').pathname.split('/').at(-1);
    if (action === 'config' && req.method === 'GET') {
      try { config(deps.env); return { body: { enabled: true } }; }
      catch { return { body: { enabled: false } }; }
    }
    config(deps.env);
    if (action === 'session' && req.method === 'GET') {
      const { user } = await authenticate(req, deps);
      return { body: { id: user.id, email: user.email } };
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    if (action === 'logout') {
      const { token } = await authenticate(req, deps);
      await upstream('/auth/v1/logout?scope=local', { ...deps, token, method: 'POST' });
      return { body: { ok: true } };
    }
    const input = await body(req, 8192);
    let path; let data;
    if (action === 'login') {
      if (Object.keys(input).some(k => !['email','password'].includes(k)) || typeof input.email !== 'string' || input.email.length > 254 || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 1024) throw new HttpError(400, 'invalid_credentials');
      path = 'password'; data = { email: input.email, password: input.password };
    } else if (action === 'refresh') {
      if (Object.keys(input).some(k => k !== 'refresh_token') || typeof input.refresh_token !== 'string' || input.refresh_token.length > 4096) throw new HttpError(400, 'invalid_input');
      path = 'refresh_token'; data = { refresh_token: input.refresh_token };
    } else throw new HttpError(404, 'not_found');
    const result = await upstream(`/auth/v1/token?grant_type=${path}`, { ...deps, method: 'POST', data });
    if (!result?.access_token || !result?.refresh_token || result.user?.is_anonymous) throw new HttpError(401, 'unauthorized');
    return { body: { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in } };
  }, { methods: ['GET','POST'], deps });
}
export default createAuthHandler();
