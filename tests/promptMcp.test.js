import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpHandler } from '../server/prompts/mcp.mjs';

const owner = '11111111-1111-4111-8111-111111111111', prompt = '22222222-2222-4222-8222-222222222222';
const origin = 'https://pilot.invalid', resource = origin + '/api/prompt-mcp';
const env = { PROMPTS_ENABLED: 'true', PROMPTS_SUPABASE_URL: 'https://test-project.supabase.co', PROMPTS_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', PROMPTS_MCP_ENABLED: 'true', PROMPTS_OAUTH_CLIENT_ID: 'test-client', PROMPTS_PUBLIC_ORIGIN: origin };
const claims = () => ({ sub: owner, iss: env.PROMPTS_SUPABASE_URL + '/auth/v1', aud: ['authenticated', resource], client_id: env.PROMPTS_OAUTH_CLIENT_ID, scope: 'email profile', exp: Math.floor(Date.now() / 1000) + 600 });
// Synthetic tokens are used only with the explicitly mocked Auth /user verifier below.
const token = overrides => 'test.' + Buffer.from(JSON.stringify({ ...claims(), ...overrides })).toString('base64url') + '.test-signature';
let server, base, rpcFailure, largeRead;
const fetcher = vi.fn(async (url, options) => {
  if (url.endsWith('/user')) return Response.json({ id: owner, email_confirmed_at: '2026-01-01' });
  if (url.endsWith('portal_prompt_limit')) return Response.json(null);
  if (rpcFailure) return Response.json({ code: rpcFailure }, { status: 409 });
  if (url.endsWith('portal_prompt_list')) return Response.json([{ id: prompt, title: 'OOTD', version: 1 }]);
  if (url.endsWith('portal_prompt_get')) return Response.json({ id: prompt, content: largeRead ? '한'.repeat(40000) : 'Untrusted prompt text', version: 1 });
  const input = JSON.parse(options.body);
  return Response.json({ id: prompt, owner_id: owner, version: input.p_version ? input.p_version + 1 : 1 });
});
const logger = { info: vi.fn() };
beforeAll(async () => {
  server = createServer(createMcpHandler({ env, fetcher, logger }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
async function post(message, { bearer = token(), headers = {} } = {}) {
  return fetch(base + '/api/prompt-mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25', ...(bearer ? { authorization: 'Bearer ' + bearer } : {}), ...headers }, body: JSON.stringify(message) });
}
const call = (name, args) => ({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });
async function clientRun(fn) {
  const client = new Client({ name: 'prompt-mcp-test', version: '1.0.0' });
  try { await client.connect(new StreamableHTTPClientTransport(new URL(base + '/api/prompt-mcp'), { requestInit: { headers: { authorization: 'Bearer ' + token() } } })); await fn(client); }
  finally { await client.close(); }
}
describe('prompt MCP transport and REST adapter', () => {
  it('publishes canonical protected-resource metadata independent of Host input', async () => {
    const r = await fetch(base + '/.well-known/oauth-protected-resource/api/prompt-mcp');
    expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ resource, authorization_servers: [env.PROMPTS_SUPABASE_URL + '/auth/v1'] });
  });
  it('serves metadata after Vercel rewrites the original path', async () => {
    const r = await fetch(base + '/api/prompt-mcp?metadata=1'); expect(r.status).toBe(200); expect((await r.json()).resource).toBe(resource);
  });
  it('fails closed while MCP is disabled', async () => {
    env.PROMPTS_MCP_ENABLED = 'false';
    try { expect((await post({})).status).toBe(503); }
    finally { env.PROMPTS_MCP_ENABLED = 'true'; }
  });
  it('challenges missing authentication before listing any tools', async () => {
    const r = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { bearer: '' });
    expect(r.status).toBe(401); expect(r.headers.get('www-authenticate')).toContain('resource_metadata="' + origin);
  });
  it('rejects general portal tokens, wrong client/issuer/owner, expiry and future nbf', async () => {
    for (const overrides of [{ aud: 'authenticated' }, { aud: resource + '/other' }, { client_id: 'other' }, { iss: 'https://evil.invalid' }, { sub: prompt }, { exp: 1 }, { nbf: Date.now() / 1000 + 300 }]) {
      expect((await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { bearer: token(overrides) })).status).toBe(401);
    }
  });
  it('requires scopes and accepts an explicitly bound signed resource claim', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { bearer: token({ scope: 'email' }) })).status).toBe(403);
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { bearer: token({ aud: 'authenticated', resource }) })).status).toBe(200);
  });
  it('rejects hostile Origin before touching Auth or database', async () => {
    fetcher.mockClear();
    expect((await post({}, { headers: { origin: 'https://evil.invalid' } })).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the official SDK client for initialization and five tool discovery', async () => {
    await clientRun(async client => {
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(['search_prompts', 'get_prompt', 'create_prompt', 'update_prompt', 'delete_prompt']);
      expect(tools.find(t => t.name === 'delete_prompt').annotations.destructiveHint).toBe(true);
      expect(tools.every(t => t._meta.securitySchemes[0].type === 'oauth2')).toBe(true);
    });
  });
  it('maps search filters to the existing list RPC and returns structured summaries', async () => {
    fetcher.mockClear();
    await clientRun(async client => {
      const r = await client.callTool({ name: 'search_prompts', arguments: { q: 'OOTD', favorite: true, tags: ['Art Toy'], limit: 3 } });
      expect(r.structuredContent.items[0].id).toBe(prompt);
      const options = fetcher.mock.calls.find(([url]) => url.endsWith('portal_prompt_list'))[1];
      expect(JSON.parse(options.body)).toMatchObject({ p_query: 'OOTD', p_favorite: true, p_tags: ['Art Toy'], p_limit: 4 });
    });
  });
  it('keeps create request_id and fixes source to chatgpt without owner injection', async () => {
    fetcher.mockClear();
    const r = await post(call('create_prompt', { request_id: owner, title: 'OOTD', content: 'body' }));
    expect((await r.json()).result.isError).not.toBe(true);
    const data = JSON.parse(fetcher.mock.calls.find(([url]) => url.endsWith('portal_prompt_write'))[1].body);
    expect(data).toMatchObject({ p_operation: 'create', p_request_id: owner, p_data: { source: 'chatgpt' } });
    for (const args of [{ owner_id: prompt }, { source: 'cli' }, { legacy: {} }]) {
      const rejected = await post(call('create_prompt', { request_id: owner, title: 'T', content: 'C', ...args }));
      expect((await rejected.json()).result.isError).toBe(true);
    }
  });
  it('reads full prompt text through get and requires an exact UUID', async () => {
    const r = await post(call('get_prompt', { id: prompt })); expect((await r.json()).result.structuredContent.content).toBe('Untrusted prompt text');
    const bad = await post(call('get_prompt', { id: '../admin' })); expect((await bad.json()).result.isError).toBe(true);
  });
  it('forwards current versions for updates and deletes', async () => {
    for (const [name, args, operation] of [['update_prompt', { id: prompt, version: 3, content: 'new' }, 'update'], ['delete_prompt', { id: prompt, version: 4 }, 'delete']]) {
      fetcher.mockClear();
      const r = await post(call(name, args)); expect((await r.json()).result.isError).not.toBe(true);
      const data = JSON.parse(fetcher.mock.calls.find(([url]) => url.endsWith('portal_prompt_write'))[1].body);
      expect(data).toMatchObject({ p_id: prompt, p_version: args.version, p_operation: operation });
    }
  });
  it('preserves not-found/conflict/deleted/rate-limit results without exposing raw DB errors', async () => {
    try {
      for (const [code, status] of [['PT404', 404], ['PT409', 409], ['PT410', 410], ['PT429', 429]]) {
        rpcFailure = code;
        const r = await post(call('update_prompt', { id: prompt, version: 1, title: 'T' }));
        const result = (await r.json()).result;
        expect(result.isError).toBe(true); expect(JSON.parse(result.content[0].text).status).toBe(status);
      }
    } finally { rpcFailure = undefined; }
  });
  it('rejects unknown tools, unknown fields, bad types and empty updates', async () => {
    for (const [name, args] of [['admin', {}], ['get_prompt', { id: prompt, owner_id: owner }], ['search_prompts', { favorite: 'true' }], ['search_prompts', { tags: ['a,b'] }], ['update_prompt', { id: prompt, version: 1 }]]) {
      const r = await post(call(name, args)); expect((await r.json()).result.isError).toBe(true);
    }
  });
  it('rejects protocol errors, batch and oversized input', async () => {
    expect((await post([call('search_prompts', {})])).status).toBe(400);
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'unknown' })).status).toBe(200);
    expect((await post({ x: 'x'.repeat(256 * 1024) })).status).toBe(413);
    expect((await post(call('search_prompts', {}), { headers: { accept: 'application/json' } })).status).toBe(406);
  });
  it('bounds the complete UTF-8 tool response including structured data', async () => {
    largeRead = true;
    try { const r = await post(call('get_prompt', { id: prompt })); const result = (await r.json()).result; expect(result.isError).toBe(true); expect(JSON.parse(result.content[0].text).error.code).toBe('mcp_response_too_large'); }
    finally { largeRead = false; }
  });
  it('refuses long-lived GET streams and session deletion in stateless mode', async () => {
    for (const method of ['GET', 'DELETE']) {
      const r = await fetch(base + '/api/prompt-mcp', { method, headers: { authorization: 'Bearer ' + token() } });
      expect(r.status).toBe(405);
    }
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('test-signature');
  });
});
