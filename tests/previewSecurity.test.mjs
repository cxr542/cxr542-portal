import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient as serverClientFactory } from '@supabase/supabase-js';
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => { throw new Error('Forbidden client construction'); }) }));
import { deploymentEnvironment, browserAllowsExternalConnections } from '../shared/preview-policy.mjs';
import portalLogin from '../api/portal-login.js';
import notify from '../api/notify-task-done.mjs';
import runningAuth from '../api/running-ops-auth.js';
import wiki from '../scripts/portal-wiki-admin/handler.mjs';
import { createAuthHandler } from '../server/prompts/auth.mjs';
import { createPromptsHandler } from '../server/prompts/handler.mjs';
import { createOAuthHandler } from '../server/prompts/oauth.mjs';
import { createMcpHandler } from '../server/prompts/mcp.mjs';

const production = { VERCEL: '1', VERCEL_ENV: 'production' };
const configuration = { ...production, PROMPTS_ENABLED: 'true', PROMPTS_SUPABASE_URL: 'https://synthetic.supabase.co', PROMPTS_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic', PROMPTS_MCP_ENABLED: 'true', PROMPTS_OAUTH_ENABLED: 'true', PROMPTS_OAUTH_CLIENT_ID: 'synthetic', PROMPTS_PUBLIC_ORIGIN: 'https://synthetic.invalid', PROMPTS_OAUTH_REDIRECT_URIS: 'https://synthetic.invalid/callback' };
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(raw) { this.body = JSON.parse(raw); }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

const denied = [
  ['preview', { VERCEL: '1', VERCEL_ENV: 'preview' }],
  ['development', { VERCEL: '1', VERCEL_ENV: 'development' }],
  ['missing', {}], ['wrong platform', { VERCEL: 'true', VERCEL_ENV: 'production' }],
  ['typo', { VERCEL: '1', VERCEL_ENV: 'Production' }],
  ['NODE_ENV only', { NODE_ENV: 'production' }],
];
for (const [label, env] of denied) {
  describe(`denied runtime: ${label}`, () => {
    it('rejects every external API boundary even with forged production headers and enabled settings', async () => {
      vi.stubEnv('VERCEL', env.VERCEL || ''); vi.stubEnv('VERCEL_ENV', env.VERCEL_ENV || '');
      const fetcher = vi.fn(() => { throw new Error('Forbidden external connection'); });
      vi.stubGlobal('fetch', fetcher);
      vi.stubEnv('RESEND_API_KEY', 'synthetic'); vi.stubEnv('NOTIFY_EMAIL_TO', 'synthetic@example.invalid');
      vi.stubEnv('GITHUB_TOKEN', 'synthetic'); vi.stubEnv('WIKI_ADMIN_API_URL', 'https://synthetic.invalid');
      const deps = { env: configuration, fetcher, logger: { info() {} } };
      const handlers = [
        [portalLogin, '/api/portal-login'], [notify, '/api/notify-task-done'],
        [runningAuth, '/api/running-ops-auth'], [wiki, '/api/admin/topics'],
        [createAuthHandler(deps), '/api/prompt-auth/login'],
        [createPromptsHandler(deps), '/api/prompts'],
        [createOAuthHandler(deps), '/api/prompt-oauth/token'],
        [createMcpHandler(deps), '/api/prompt-mcp'],
        [createMcpHandler(deps), '/.well-known/oauth-protected-resource/api/prompt-mcp'],
      ];
      for (const [handler, url] of handlers) {
        const res = response();
        await handler({ method: url.includes('.well-known') ? 'GET' : 'POST', url, headers: { host: 'cxr542-portal.vercel.app', origin: 'https://cxr542-portal.vercel.app', 'content-type': 'application/json', authorization: 'Bearer synthetic-user-token' }, body: {} }, res);
        expect(res.statusCode, url).toBe(503);
      }
      expect(fetcher).not.toHaveBeenCalled();
      expect(serverClientFactory).not.toHaveBeenCalled();
    });
    it('does not construct Supabase during browser client import', async () => {
      const createClient = vi.fn(() => { throw new Error('Forbidden Supabase construction'); });
      vi.doMock('@supabase/supabase-js', () => ({ createClient }));
      vi.stubGlobal('__PORTAL_BUILD_ENV__', deploymentEnvironment(env));
      vi.stubGlobal('location', { origin: 'https://cxr542-portal.vercel.app' });
      const module = await import('../src/cloud/client.js');
      expect(module.client).toBeNull(); expect(module.externalConnectionsAllowed).toBe(false);
      expect(createClient).not.toHaveBeenCalled();
      vi.doUnmock('@supabase/supabase-js');
    });
  });
}
it('allows the production client contract only with a matching build and exact production origin', async () => {
  vi.stubGlobal('__PORTAL_BUILD_ENV__', 'production');
  vi.stubGlobal('location', { origin: 'https://cxr542-portal.vercel.app' });
  const client = { auth: {} }; const createClient = vi.fn(() => client);
  vi.doMock('@supabase/supabase-js', () => ({ createClient }));
  const result = await import('../src/cloud/client.js');
  expect(result.client).toBe(client); expect(createClient).toHaveBeenCalledTimes(1);
  expect(browserAllowsExternalConnections('production', 'https://other.vercel.app')).toBe(false);
  expect(browserAllowsExternalConnections('unknown', 'https://cxr542-portal.vercel.app')).toBe(false);
  vi.doUnmock('@supabase/supabase-js');
});
it('retains production notification behavior with a synthetic provider', async () => {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('RESEND_API_KEY', 'synthetic'); vi.stubEnv('NOTIFY_EMAIL_TO', 'synthetic@example.invalid');
  const fetcher = vi.fn(async () => Response.json({ id: 'synthetic-mail' })); vi.stubGlobal('fetch', fetcher);
  const res = response(); await notify({ method: 'POST', body: {} }, res);
  expect(res.statusCode).toBe(200); expect(res.body.sent).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('renders the blocked React screen without initializing cloud bootstrap', async () => {
  let rendered;
  vi.doMock('react-dom/client', () => ({ createRoot: () => ({ render(tree) { rendered = tree; } }) }));
  vi.doMock('../src/cloud/client.js', () => ({ client: null, externalConnectionsAllowed: false }));
  vi.stubGlobal('document', { getElementById: () => ({}) });
  const fetcher = vi.fn(() => { throw new Error('Network forbidden'); }); vi.stubGlobal('fetch', fetcher);
  await import('../src/main.jsx');
  await Promise.resolve();
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(rendered);
  expect(html).toContain('외부 연결이 중지된 검증 화면');
  expect(html).not.toContain('<form'); expect(fetcher).not.toHaveBeenCalled();
  vi.doUnmock('react-dom/client'); vi.doUnmock('../src/cloud/client.js');
});
it('keeps the default production login handler wired to its configured owner', async () => {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('PORTAL_LOGIN_ID', 'synthetic-id'); vi.stubEnv('PORTAL_ACCOUNT_EMAIL', 'synthetic@example.invalid'); vi.stubEnv('PORTAL_OWNER_USER_ID', 'synthetic-owner');
  const authenticate = vi.fn(async () => ({ data: { user: { id: 'synthetic-owner' }, session: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' } }, error: null }));
  serverClientFactory.mockReturnValue({ auth: { signInWithPassword: authenticate } });
  const res = response();
  await portalLogin({ method: 'POST', body: { loginId: 'synthetic-id', password: 'synthetic-password' } }, res);
  expect(res.statusCode).toBe(200); expect(res.body).toEqual({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
  expect(authenticate).toHaveBeenCalledWith({ email: 'synthetic@example.invalid', password: 'synthetic-password' });
});

async function viteConfiguration(environment, command = 'serve') {
  vi.stubEnv('VERCEL', environment === 'unknown' ? '' : '1');
  vi.stubEnv('VERCEL_ENV', environment === 'unknown' ? '' : environment);
  const {default:configuration}=await import('../vite.config.js');
  return configuration({command,mode:'test'});
}
async function viteRequest(plugin, path, payload, previewServer=false) {
  const middleware=[];
  const server={middlewares:{use(fn){middleware.push(fn);}}};
  plugin[previewServer?'configurePreviewServer':'configureServer'](server);
  let nextCalls=0,ends=0;const res=response();const end=res.end;
  res.end=function(raw){ends+=1;return end.call(this,raw);};
  const req={url:path,method:'POST',headers:{host:'cxr542-portal.vercel.app',origin:'https://cxr542-portal.vercel.app'},async *[Symbol.asyncIterator](){yield JSON.stringify(payload);}};
  for(const fn of middleware)await fn(req,res,()=>{nextCalls+=1;});
  return {res,ends,nextCalls};
}
it.each(['preview','development','unknown'])('Vite %s authentication refuses before using credentials',async environment=>{
  const config=await viteConfiguration(environment);
  vi.stubEnv('MANAGER_PASSWORD','synthetic-password');
  const auth=config.plugins.find(p=>p.name==='running-ops-auth');
  for(const previewServer of [false,true]){
    const {res,ends}=await viteRequest(auth,'/api/running-ops-auth',{role:'manager',password:'synthetic-password'},previewServer);
    expect(res.statusCode).toBe(503);expect(res.body.error).toBe('external_connections_disabled');expect(ends).toBe(1);
  }
});
it.each(['preview','development','unknown'])('Vite %s Wiki requests cannot reach the proxy',async environment=>{
  const config=await viteConfiguration(environment);
  expect(config.server.proxy?.['/api/admin']).toBeUndefined();
  const boundary=config.plugins.find(p=>p.name==='preview-external-boundary');
  expect(boundary).toBeDefined();
  for(const path of ['/api/admin','/api/admin/topics?mode=edit']){
    for(const previewServer of [false,true]) {
      const result=await viteRequest(boundary,path,{},previewServer);
      expect(result.res.statusCode).toBe(503);expect(result.ends).toBe(1);expect(result.nextCalls).toBe(0);
    }
  }
});
it('Vite login adapter returns one HTTP refusal without throwing or losing status',async()=>{
  const config=await viteConfiguration('development');
  const plugin=config.plugins.find(p=>p.name==='portal-login');
  for(const previewServer of [false,true]){
    const {res,ends}=await viteRequest(plugin,'/api/portal-login',{loginId:'synthetic',password:'synthetic'},previewServer);
    expect(res.statusCode).toBe(503);expect(res.body.error).toBe('external_connections_disabled');expect(ends).toBe(1);
  }
});
it('Vite production retains synthetic authentication and its configured proxy',async()=>{
  const config=await viteConfiguration('production');vi.stubEnv('MANAGER_PASSWORD','synthetic-password');
  const {res,ends}=await viteRequest(config.plugins.find(p=>p.name==='running-ops-auth'),'/api/running-ops-auth',{role:'manager',password:'synthetic-password'});
  expect(res.statusCode).toBe(200);expect(res.body.role).toBe('manager');expect(ends).toBe(1);
  expect(config.server.proxy['/api/admin'].target).toBeTruthy();
});

it.each(['preview','development','unknown'])('Vite %s sends real HTTP refusals without forwarding to a synthetic upstream',async environment=>{
  const {createServer:createHttpServer}=await import('node:http');
  const {createServer:createViteServer}=await import('vite');
  let forwarded=0;
  const upstream=createHttpServer((_req,res)=>{forwarded+=1;res.end('unexpected forwarding');});
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  let server;
  try {
    vi.stubEnv('WIKI_DEV_API_URL',`http://127.0.0.1:${upstream.address().port}`);
    const config=await viteConfiguration(environment);
    server=await createViteServer({...config,configFile:false,cacheDir:'/tmp/cxr542-vite-security-cache',optimizeDeps:{noDiscovery:true,include:[]},server:{...config.server,host:'127.0.0.1',port:0,strictPort:false}});
    await server.listen();
    const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    for(const path of ['/api/portal-login','/api/running-ops-auth','/api/admin/topics']){
      const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'manager',password:'synthetic-password'})});
      expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'external_connections_disabled'});
    }
    expect(forwarded).toBe(0);
  } finally {
    await server?.close();
    await new Promise((resolve,reject)=>upstream.close(error=>error?reject(error):resolve()));
  }
});
