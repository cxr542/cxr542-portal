import { authenticate, body, config, endpoint, HttpError, upstream } from './http.mjs';

function authorizationId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new HttpError(400,'invalid_input');
}

function settings(env = process.env) {
  config(env);
  if (env.PROMPTS_OAUTH_ENABLED !== 'true' || !env.PROMPTS_OAUTH_CLIENT_ID || !env.PROMPTS_PUBLIC_ORIGIN || !env.PROMPTS_OAUTH_REDIRECT_URIS) throw new HttpError(503,'oauth_not_configured');
  const origin = new URL(env.PROMPTS_PUBLIC_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.PROMPTS_PUBLIC_ORIGIN) throw new HttpError(503,'invalid_configuration');
  const redirects = env.PROMPTS_OAUTH_REDIRECT_URIS.split(',').map(s => s.trim());
  if (redirects.some(s => new URL(s).protocol !== 'https:')) throw new HttpError(503,'invalid_configuration');
  return { origin:origin.origin, client:env.PROMPTS_OAUTH_CLIENT_ID, redirects };
}
function callback(value, settings) {
  const url = new URL(value);
  if (!settings.redirects.some(r => { const allowed = new URL(r); return url.origin === allowed.origin && url.pathname === allowed.pathname; })) throw new HttpError(400,'invalid_redirect');
  return url.href;
}
async function form(req) {
  if (/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return body(req,8192);
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415,'unsupported_media_type');
  let raw = req.body;
  if (raw === undefined) {
    raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw)>8192) throw new HttpError(413,'request_too_large'); }
  }
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) { if (Buffer.byteLength(JSON.stringify(raw))>8192) throw new HttpError(413,'request_too_large'); return raw; }
  if (Buffer.byteLength(raw)>8192) throw new HttpError(413,'request_too_large');
  const params = new URLSearchParams(String(raw));
  for (const [k] of params) if (params.getAll(k).length!==1) throw new HttpError(400,'invalid_input');
  return Object.fromEntries(params);
}
export function createOAuthHandler(deps = {}) {
  return endpoint(async req => {
    const s = settings(deps.env); const c = config(deps.env);
    const url = new URL(req.url,'https://portal.invalid'); const action = req.query?.action || url.pathname.split('/').at(-1);
    if (action === 'authorize' && req.method === 'GET') {
      const p = url.searchParams;
      const allowed=['client_id','redirect_uri','response_type','state','scope','code_challenge','code_challenge_method'];
      if ([...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1) || p.get('client_id')!==s.client || !s.redirects.includes(p.get('redirect_uri')) || p.get('response_type')!=='code' || !p.get('state') || p.get('state').length>1024 || p.get('code_challenge_method')!=='S256' || !/^[A-Za-z0-9_-]{43}$/.test(p.get('code_challenge')||'')) throw new HttpError(400,'invalid_oauth_request');
      if ((p.get('scope')||'').split(' ').some(v=>!['openid','email','profile',''].includes(v))) throw new HttpError(400,'invalid_scope');
      const response = await (deps.fetcher || fetch)(`${c.url}/auth/v1/oauth/authorize?${p}`, { headers:{apikey:c.key},redirect:'manual',signal:AbortSignal.timeout(12000) });
      const location = response.headers.get('location');
      if (!location || ![302,303,307].includes(response.status)) throw new HttpError(400,'oauth_authorization_failed');
      const target = new URL(location,c.url);
      if (target.origin === s.origin && target.pathname === '/prompt-collection/index.html') return { redirect:target.href };
      return { redirect:callback(target.href,s) };
    }
    if (action === 'token' && req.method === 'POST') {
      const input = await form(req);
      if (Object.keys(input).some(k=>!['grant_type','client_id','client_secret','code','redirect_uri','code_verifier','refresh_token'].includes(k))) throw new HttpError(400,'invalid_oauth_request');
      let basic;
      if (req.headers.authorization) {
        if (!req.headers.authorization.startsWith('Basic ')) throw new HttpError(401,'invalid_client');
        basic=Buffer.from(req.headers.authorization.slice(6),'base64').toString();
        if (basic.slice(0,basic.indexOf(':'))!==s.client) throw new HttpError(401,'invalid_client');
      } else if (input.client_id!==s.client) throw new HttpError(401,'invalid_client');
      if (!['authorization_code','refresh_token'].includes(input.grant_type)) throw new HttpError(400,'unsupported_grant_type');
      if (input.grant_type==='authorization_code' && (!s.redirects.includes(input.redirect_uri)||!input.code||!/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier||''))) throw new HttpError(400,'invalid_oauth_request');
      if (input.grant_type==='refresh_token' && !input.refresh_token) throw new HttpError(400,'invalid_oauth_request');
      const response=await (deps.fetcher||fetch)(`${c.url}/auth/v1/oauth/token`,{method:'POST',headers:{apikey:c.key,'content-type':'application/x-www-form-urlencoded',...(basic?{authorization:req.headers.authorization}:{})},body:new URLSearchParams(input).toString(),signal:AbortSignal.timeout(12000)});
      const result=await response.json().catch(()=>null);
      if (!response.ok || !result?.access_token) throw new HttpError(response.status===429?429:401,'oauth_token_failed');
      return {body:{access_token:result.access_token,token_type:result.token_type||'bearer',expires_in:result.expires_in,refresh_token:result.refresh_token,scope:result.scope}};
    }
    if (['details','consent'].includes(action) && req.method === 'POST') {
      const { token } = await authenticate(req,deps); const input=await body(req,8192); authorizationId(input.authorization_id);
      if (Object.keys(input).some(k=>!['authorization_id','decision'].includes(k))) throw new HttpError(400,'invalid_input');
      const path='/auth/v1/oauth/authorizations/'+input.authorization_id;
      const details=await upstream(path,{...deps,token});
      if (details.redirect_url) return {body:{redirect_url:callback(details.redirect_url,s)}};
      if (details.client?.id!==s.client || !s.redirects.includes(details.redirect_uri)) throw new HttpError(403,'invalid_client');
      if (action==='details') return {body:{name:details.client.name,scope:details.scope,redirect_uri:details.redirect_uri}};
      if (!['approve','deny'].includes(input.decision)) throw new HttpError(400,'invalid_input');
      const result=await upstream(path+'/consent',{...deps,token,method:'POST',data:{action:input.decision}});
      return {body:{redirect_url:callback(result.redirect_url,s)}};
    }
    throw new HttpError(404,'not_found');
  },{methods:['GET','POST'],deps});
}
export default createOAuthHandler();
