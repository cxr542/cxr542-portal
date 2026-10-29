import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createMcpHandler } from '../server/prompts/mcp.mjs';

const root = '.cache/supabase-native';
const local = JSON.parse(readFileSync(root + '/status.json', 'utf8'));
assert.equal(local.API_URL, 'http://127.0.0.1:56421', 'Only the dedicated local Auth server is permitted');
const resource = 'https://portal.invalid/api/prompt-mcp';
const callback = 'https://client.invalid/callback';
async function native(path, { method = 'GET', data, token = local.SERVICE_ROLE_KEY, form } = {}) {
  const r = await fetch(local.API_URL + path, { method, headers: { apikey: local.PUBLISHABLE_KEY, authorization: 'Bearer ' + token, 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, redirect: 'manual', ...(data ? { body: form ? new URLSearchParams(data).toString() : JSON.stringify(data) } : {}) });
  return { status: r.status, location: r.headers.get('location'), body: await r.json().catch(() => null) };
}
const withHook = process.argv.includes('--with-hook');
function sql(query) { return execFileSync('docker', ['exec', '-i', 'supabase_db_cxr542-prompts-native-20261028', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: query, encoding: 'utf8' }); }
let client, user, server;
const results = [];
try {
  const registered = await native('/auth/v1/admin/oauth/clients', { method: 'POST', data: { client_name: 'Local MCP resource compatibility', redirect_uris: [callback], client_type: 'confidential', token_endpoint_auth_method: 'client_secret_post' } });
  assert.equal(registered.status, 201); client = registered.body;
  assert.match(client.client_id, /^[0-9a-f-]{36}$/);
  if (withHook) sql(`insert into prompt_preview_private.mcp_oauth_resources(client_id,resource,enabled) values ('${client.client_id}','${resource}',true);`);
  const email = 'mcp-' + randomUUID() + '@example.invalid', password = randomBytes(24).toString('base64url') + 'Ab9!';
  const created = await native('/auth/v1/admin/users', { method: 'POST', data: { email, password, email_confirm: true } });
  assert.equal(created.status, 200); user = created.body;
  const login = await native('/auth/v1/token?grant_type=password', { method: 'POST', data: { email, password } });
  assert.equal(login.status, 200);
  const loginClaims = JSON.parse(Buffer.from(login.body.access_token.split('.')[1], 'base64url'));
  assert.equal(loginClaims.resource, undefined, 'Ordinary login must remain unbound');
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: callback, response_type: 'code', state: randomBytes(24).toString('base64url'), scope: 'email profile', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource });
  const authorization = await native('/auth/v1/oauth/authorize?' + query);
  assert.ok([302, 303].includes(authorization.status));
  const redirect = new URL(authorization.location);
  if (!redirect.searchParams.has('authorization_id')) console.info(JSON.stringify({ stage: 'authorize', error: redirect.searchParams.get('error'), description: redirect.searchParams.get('error_description') }));
  const authorizationId = redirect.searchParams.get('authorization_id');
  assert.ok(authorizationId, 'Native resource authorization must reach consent');
  const details = await native('/auth/v1/oauth/authorizations/' + authorizationId, { token: login.body.access_token });
  assert.equal(details.status, 200);
  const decision = await native('/auth/v1/oauth/authorizations/' + authorizationId + '/consent', { method: 'POST', token: login.body.access_token, data: { action: 'approve' } });
  assert.equal(decision.status, 200);
  const code = new URL(decision.body.redirect_url).searchParams.get('code');
  const exchange = await native('/auth/v1/oauth/token', { method: 'POST', form: true, data: { grant_type: 'authorization_code', client_id: client.client_id, client_secret: client.client_secret, redirect_uri: callback, code, code_verifier: verifier, resource } });
  assert.equal(exchange.status, 200);
  const claims = JSON.parse(Buffer.from(exchange.body.access_token.split('.')[1], 'base64url'));
  assert.equal(claims.client_id, client.client_id);
  const bound = (Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(resource) || claims.resource === resource;
  results.push({ name: 'Actual native PKCE code exchange with resource parameter', pass: true, resourceBound: bound, audience: claims.aud, resourceClaimPresent: claims.resource !== undefined, scopeClaimPresent: claims.scope !== undefined });
  const env = { NODE_ENV: 'test', PROMPTS_LOCAL_TEST: 'true', PROMPTS_ENABLED: 'true', PROMPTS_SUPABASE_URL: local.API_URL, PROMPTS_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY, PROMPTS_MCP_ENABLED: 'true', PROMPTS_PUBLIC_ORIGIN: 'https://portal.invalid', PROMPTS_OAUTH_CLIENT_ID: client.client_id };
  server = createServer(createMcpHandler({ env, logger: { info() {} } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const passwordTokenCheck = await fetch('http://127.0.0.1:' + server.address().port + '/api/prompt-mcp', { method: 'POST', headers: { authorization: 'Bearer ' + login.body.access_token, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal(passwordTokenCheck.status, 401);
  results.push({ name: 'Genuine password login token cannot call MCP', pass: true });
  const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/prompt-mcp', { method: 'POST', headers: { authorization: 'Bearer ' + exchange.body.access_token, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal(r.status, withHook ? 200 : 401);
  if (withHook) assert.equal(bound, true);
  results.push({ name: withHook ? 'MCP accepts the native signed resource-bound token' : 'MCP rejects unbound native OAuth before prompt DB access', pass: withHook ? bound && r.status === 200 : !bound && r.status === 401, status: r.status });
  if (withHook) {
    sql(`do $$ begin
      if has_table_privilege('authenticated','prompt_preview_private.mcp_oauth_resources','INSERT') or has_table_privilege('anon','prompt_preview_private.mcp_oauth_resources','SELECT') or has_function_privilege('authenticated','prompt_preview_private.mcp_access_token_hook(jsonb)','EXECUTE') then raise exception 'Unexpected hook permissions'; end if;
      if prompt_preview_private.mcp_access_token_hook('{"claims":{"sub":"ordinary","aud":"authenticated","user_metadata":{"client_id":"${client.client_id}"}}}'::jsonb) <> '{"claims":{"sub":"ordinary","aud":"authenticated","user_metadata":{"client_id":"${client.client_id}"}}}'::jsonb then raise exception 'Ordinary login changed'; end if;
    end $$;`);
    results.push({ name: 'Hook grants deny public access and ignore user-editable metadata', pass: true });
    const sdkClient = new Client({ name: 'native-mcp-verification', version: '1.0.0' });
    try {
      await sdkClient.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + server.address().port + '/api/prompt-mcp'), { requestInit: { headers: { authorization: 'Bearer ' + exchange.body.access_token } } }));
      assert.equal((await sdkClient.listTools()).tools.length, 5);
      const saved = await sdkClient.callTool({ name: 'create_prompt', arguments: { request_id: randomUUID(), title: 'Local MCP native verification', content: 'Local test only' } });
      assert.ok(!saved.isError); assert.equal(saved.structuredContent.owner_id, user.id);
      const record = saved.structuredContent;
      const read = await sdkClient.callTool({ name: 'get_prompt', arguments: { id: record.id } });
      assert.equal(read.structuredContent.content, 'Local test only');
      const updated = await sdkClient.callTool({ name: 'update_prompt', arguments: { id: record.id, version: record.version, favorite: true } });
      assert.ok(!updated.isError);
      const stale = await sdkClient.callTool({ name: 'update_prompt', arguments: { id: record.id, version: record.version, title: 'Stale' } });
      assert.equal(JSON.parse(stale.content[0].text).status, 409);
      const deleted = await sdkClient.callTool({ name: 'delete_prompt', arguments: { id: record.id, version: updated.structuredContent.version } });
      assert.ok(!deleted.isError);
      results.push({ name: 'Official SDK + real Auth + real Postgres create/read/update/conflict/delete', pass: true });
      const refreshed = await native('/auth/v1/oauth/token', { method: 'POST', form: true, data: { grant_type: 'refresh_token', client_id: client.client_id, client_secret: client.client_secret, refresh_token: exchange.body.refresh_token, resource } });
      assert.equal(refreshed.status, 200);
      const freshClaims = JSON.parse(Buffer.from(refreshed.body.access_token.split('.')[1], 'base64url'));
      assert.equal(freshClaims.resource, resource);
      results.push({ name: 'Resource binding survives native refresh; ordinary password login unchanged', pass: true });
    } finally { await sdkClient.close(); }
  }
  writeFileSync(root + (withHook ? '/mcp-hook-results.json' : '/mcp-results.json'), JSON.stringify({ engine: 'Native local Supabase Auth', cloudChanged: false, oauthCompatibility: bound ? 'local-hook-verified' : 'blocked-resource-binding', results }, null, 2));
  console.info(JSON.stringify({ oauthCompatibility: bound ? 'local-hook-verified' : 'blocked-resource-binding', results }));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (user) { await native('/auth/v1/admin/users/' + user.id, { method: 'DELETE' }); }
  if (client && withHook) sql(`delete from prompt_preview_private.mcp_oauth_resources where client_id='${client.client_id}';`);
  if (client) await native('/auth/v1/admin/oauth/clients/' + client.client_id, { method: 'DELETE' });
}
