const KEY = 'prompt-central-session-v1';
let session;
let refreshing;
let family = 0;
try { session = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { session = null; }
export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
function remember(value, newFamily = true) {
  if (newFamily) family++;
  session = value;
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
  else sessionStorage.removeItem(KEY);
}
async function send(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options.headers }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, result?.error?.code || 'invalid_response');
  if (!result) throw new ApiError(502, 'invalid_response');
  return result;
}
async function refresh() {
  const initialFamily = family;
  if (!refreshing) refreshing = send('/api/prompt-auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: session?.refresh_token }) })
    .then(value => { if (initialFamily !== family) throw new ApiError(401,'session_changed'); remember({ ...session,...value },false); }).catch(err => { if (err.status === 401 && initialFamily === family) remember(null); throw err; }).finally(() => { refreshing = null; });
  return refreshing;
}
export const api = {
  configured: () => send('/api/prompt-auth/config'),
  async login(email, password) { remember(await send('/api/prompt-auth/login', { method:'POST', body:JSON.stringify({ email, password }) })); return this.user(); },
  async logout() { try { if (session) await this.request('/api/prompt-auth/logout','POST'); } finally { remember(null); } },
  hasSession: () => !!session,
  async user() { const profile = await this.request('/api/prompt-auth/session'); remember({ ...session,profile },false); return profile; },
  cachedUser: () => session?.profile || null,
  async request(path, method = 'GET', data, retried = false) {
    if (!session) throw new ApiError(401, 'unauthorized');
    const initialFamily = family;
    try {
      const result = await send(path, { method, headers: { authorization: `Bearer ${session.access_token}` }, ...(data === undefined ? {} : { body:JSON.stringify(data) }) });
      if (initialFamily !== family) throw new ApiError(401,'session_changed');
      return result;
    }
    catch (err) {
      if (initialFamily !== family) throw new ApiError(401,'session_changed');
      if (err.status === 401 && !retried && session.refresh_token) { await refresh(); return this.request(path,method,data,true); }
      if (err.status === 401) remember(null);
      throw err;
    }
  },
  async all(includeContent = false, includeDeleted = false) {
    const items = []; let cursor;
    do {
      const page = await this.request(`/api/prompts?limit=${includeContent ? 10 : 50}${includeContent ? '&include_content=true' : ''}${includeDeleted ? '&include_deleted=true' : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      items.push(...page.items); cursor = page.next_cursor;
    } while (cursor);
    return items;
  },
  get: id => api.request(`/api/prompts/${encodeURIComponent(id)}`),
  create: data => api.request('/api/prompts','POST',data),
  update: (id,data) => api.request(`/api/prompts/${encodeURIComponent(id)}`,'PATCH',data),
  delete: (id,version) => api.request(`/api/prompts/${encodeURIComponent(id)}`,'DELETE',{ version }),
};
