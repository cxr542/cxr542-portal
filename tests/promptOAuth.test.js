import { describe, expect, it, vi } from 'vitest';
import { createOAuthHandler } from '../server/prompts/oauth.mjs';
const id='11111111-1111-4111-8111-111111111111';
const authorizationId='OpaqueAuthorizationIdForTest_1234';
const callback='https://chatgpt.com/aip/g-test/oauth/callback';
const env={PROMPTS_ENABLED:'true',PROMPTS_SUPABASE_URL:'https://test-project.supabase.co',PROMPTS_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',PROMPTS_OAUTH_ENABLED:'true',PROMPTS_OAUTH_CLIENT_ID:id,PROMPTS_PUBLIC_ORIGIN:'https://portal.invalid',PROMPTS_OAUTH_REDIRECT_URIS:callback};
async function call({action='authorize',method='GET',data,query,fetcher=vi.fn(),configuration=env,headers={}}={}){
  const handler=createOAuthHandler({env:configuration,fetcher,logger:{info(){}}});
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(raw){this.body=JSON.parse(raw);}};
  await handler({url:'/api/prompt-oauth/'+action+(query?'?'+query:''),method,body:data,headers:{'content-type':'application/json',authorization:'Bearer token-valid-for-test-only',...headers}},res);return res;
}
const params=()=>new URLSearchParams({client_id:id,redirect_uri:callback,response_type:'code',state:'state-random-test-only',scope:'email profile',code_challenge:'a'.repeat(43),code_challenge_method:'S256'});
describe('OAuth boundary',()=>{
  it('fails closed before OAuth is explicitly enabled',async()=>expect((await call({configuration:{...env,PROMPTS_OAUTH_ENABLED:'false'}})).statusCode).toBe(503));
  it('rejects no PKCE, unregistered callbacks and state omission before upstream',async()=>{
    for(const change of [p=>p.delete('code_challenge'),p=>p.set('redirect_uri','https://evil.invalid'),p=>p.delete('state')]){const p=params();change(p);const fetcher=vi.fn();expect((await call({query:p,fetcher})).statusCode).toBe(400);expect(fetcher).not.toHaveBeenCalled();}
  });
  it('only redirects to the local consent page or registered callback',async()=>{
    let fetcher=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://portal.invalid/prompt-collection/index.html?authorization_id='+id}}));
    expect((await call({query:params(),fetcher})).statusCode).toBe(303);
    fetcher=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid/phish'}}));
    expect((await call({query:params(),fetcher})).statusCode).toBe(400);
  });
  it('forwards PKCE token requests but returns no client secret',async()=>{
    const fetcher=vi.fn(async()=>Response.json({access_token:'user-token',refresh_token:'refresh',client_secret:'hidden',expires_in:3600}));
    const r=await call({action:'token',method:'POST',headers:{authorization:''},data:{client_id:id,client_secret:'test-only',grant_type:'authorization_code',code:'code',code_verifier:'v'.repeat(43),redirect_uri:callback},fetcher});
    expect(r.statusCode).toBe(200);expect(r.body.access_token).toBe('user-token');expect(r.body).not.toHaveProperty('client_secret');
    expect(fetcher.mock.calls[0][1].body).toContain('code_verifier=');
  });
  it('requires a verified account and correct OAuth client for consent',async()=>{
    const fetcher=vi.fn(async url=>url.endsWith('/user')?Response.json({id,email_confirmed_at:'2026-01-01'}):Response.json({client:{id:'wrong'},redirect_uri:callback}));
    expect((await call({action:'consent',method:'POST',data:{authorization_id:authorizationId,decision:'approve'},fetcher})).statusCode).toBe(403);
  });
  it('binds approval to an allowed callback',async()=>{
    const fetcher=vi.fn(async url=>url.endsWith('/user')?Response.json({id,email_confirmed_at:'2026-01-01'}):url.endsWith('/consent')?Response.json({redirect_url:callback+'?code=x&state=test'}):Response.json({client:{id,name:'Test GPT'},scope:'email profile',redirect_uri:callback}));
    const r=await call({action:'consent',method:'POST',data:{authorization_id:authorizationId,decision:'approve'},fetcher});expect(r.statusCode).toBe(200);expect(r.body.redirect_url).toContain('?code=x');
  });
  it('accepts native opaque authorization IDs and rejects path injection before details lookup',async()=>{
    const fetcher=vi.fn(async url=>url.endsWith('/user')?Response.json({id,email_confirmed_at:'2026-01-01'}):Response.json({client:{id,name:'GPT pilot'},scope:'email profile',redirect_uri:callback}));
    const r=await call({action:'details',method:'POST',data:{authorization_id:authorizationId},fetcher});expect(r.statusCode).toBe(200);expect(r.body.name).toBe('GPT pilot');
    expect(fetcher.mock.calls[1][0]).toContain('/authorizations/'+authorizationId);
    for(const invalid of [null,'short','a'.repeat(129),'../../admin/users','a'.repeat(32)+'%2fconsent','a'.repeat(32)+'?decision=approve']){
      fetcher.mockClear();expect((await call({action:'details',method:'POST',data:{authorization_id:invalid},fetcher})).statusCode).toBe(400);
      expect(fetcher.mock.calls).toHaveLength(1);
    }
  });
});
