import { authenticate, body, endpoint, HttpError, upstream } from './http.mjs';
import { invalid, uuid, validate, version } from './validation.mjs';

export function createPromptsHandler(deps = {}) {
  return endpoint(async req => {
    const { token } = await authenticate(req, deps);
    await upstream('/rest/v1/rpc/portal_prompt_limit', { ...deps, token, method:'POST',data:{ p_write:req.method !== 'GET' } });
    const url = new URL(req.url, 'https://portal.invalid');
    const id = req.promptCollection ? null : req.query?.id || url.pathname.match(/^\/api\/prompts\/([^/]+)\/?$/)?.[1];
    if (id) uuid(id);
    if (!id && req.method === 'GET') {
      const allowed = ['q', 'category', 'tags', 'favorite', 'cursor', 'limit', 'include_content', 'include_deleted'];
      for (const [key] of url.searchParams) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) invalid();
      const get = k => url.searchParams.get(k);
      if (get('include_content') && !['true','false'].includes(get('include_content'))) invalid();
      const full = get('include_content') === 'true';
      if (get('include_deleted') && (!full || !['true','false'].includes(get('include_deleted')))) invalid();
      const limit = Number(get('limit') || 20);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (get('q') || '').length > 200 || (get('category') || '').length > 100) invalid();
      const tags = get('tags') ? get('tags').split(',') : [];
      if (tags.length > 20 || tags.some(t => !t || t.length > 60)) invalid();
      if (get('favorite') && !['true', 'false'].includes(get('favorite'))) invalid();
      let cursor = null;
      if (get('cursor')) {
        try { cursor = JSON.parse(Buffer.from(get('cursor'), 'base64url').toString()); } catch { invalid(); }
        if (!cursor || !Number.isFinite(Date.parse(cursor.updated_at))) invalid();
        uuid(cursor.id);
      }
      const rows = await upstream('/rest/v1/rpc/' + (full ? 'portal_prompt_export' : 'portal_prompt_list'), { ...deps, token, method: 'POST', data: {
        p_query: get('q') || '', p_category: get('category'), p_tags: tags,
        p_favorite: get('favorite') ? get('favorite') === 'true' : null,
        p_cursor_time: cursor?.updated_at || null, p_cursor_id: cursor?.id || null, p_limit: limit + 1,
        ...(full ? {p_include_deleted:get('include_deleted') === 'true'} : {}),
      } });
      const items = [];
      for (const row of rows.slice(0,limit)) {
        if (items.length && JSON.stringify([...items,row]).length > 90000) break;
        items.push(row);
      }
      const last = items.at(-1);
      return { body: { items, next_cursor: rows.length > items.length ? Buffer.from(JSON.stringify({ updated_at: last.updated_at, id: last.id })).toString('base64url') : null } };
    }
    if (id && req.method === 'GET') {
      const row = await upstream('/rest/v1/rpc/portal_prompt_get', { ...deps, token, method:'POST', data:{ p_id:id } });
      if (!row) throw new HttpError(404, 'not_found');
      return { body: row };
    }
    if ((!id && req.method !== 'POST') || (id && req.method === 'POST')) throw new HttpError(405, 'method_not_allowed');
    const input = await body(req);
    let data = {};
    if (req.method === 'DELETE') {
      if (Object.keys(input).some(k => k !== 'version')) invalid();
      version(input.version);
    } else data = validate(input, !id);
    const result = await upstream('/rest/v1/rpc/portal_prompt_write', { ...deps, token, method: 'POST', data: {
      p_operation: req.method === 'POST' ? 'create' : req.method === 'PATCH' ? 'update' : 'delete',
      p_id: id || null, p_version: input.version || null, p_request_id: input.request_id || null, p_data: data,
    } });
    return { status: !id ? 201 : 200, body: result };
  }, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], deps });
}
export default createPromptsHandler();
