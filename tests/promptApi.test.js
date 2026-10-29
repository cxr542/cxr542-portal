import { describe, expect, it, vi } from 'vitest';
import { createPromptsHandler } from '../server/prompts/handler.mjs';
import { createAuthHandler } from '../server/prompts/auth.mjs';
import { config, upstream } from '../server/prompts/http.mjs';
const id='11111111-1111-4111-8111-111111111111';
const env={PROMPTS_ENABLED:'true',PROMPTS_SUPABASE_URL:'https://test-project.supabase.co',PROMPTS_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const token='valid-user-token-not-a-real-secret';
const user={id,email:'test@example.invalid',email_confirmed_at:'2026-01-01'};
describe('explicit native-local test configuration',()=>{
  const local={...env,PROMPTS_SUPABASE_URL:'http://127.0.0.1:56421',PROMPTS_LOCAL_TEST:'true',NODE_ENV:'test'};
  it('allows only opted-in loopback tests and never Vercel or production',()=>{
    expect(config(local).url).toBe(local.PROMPTS_SUPABASE_URL);
    for(const changes of [{NODE_ENV:'production'},{VERCEL:'1'},{PROMPTS_LOCAL_TEST:'false'},{PROMPTS_SUPABASE_URL:'http://192.168.1.1:56421'},{PROMPTS_SUPABASE_PUBLISHABLE_KEY:'sb_secret_disallowed'}])expect(()=>config({...local,...changes})).toThrow('invalid_configuration');
  });
});
describe('fixed preview database profile',()=>{
  const previewEnv={...env,VERCEL:'1',VERCEL_ENV:'preview',PROMPTS_DB_SCHEMA:'prompt_preview'};
  it('allows only the fixed preview schema in Preview or explicit native tests',()=>{
    expect(config(previewEnv).schema).toBe('prompt_preview');
    expect(config({...env,PROMPTS_DB_SCHEMA:'public'}).schema).toBe('public');
    for(const changes of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL:''},{PROMPTS_DB_SCHEMA:'auth'},{PROMPTS_DB_SCHEMA:'prompt_preview_private'},{PROMPTS_DB_SCHEMA:'public;DROP TABLE x'}])expect(()=>config({...previewEnv,...changes})).toThrow('invalid_configuration');
    expect(config({...env,PROMPTS_DB_SCHEMA:'prompt_preview',NODE_ENV:'test',PROMPTS_LOCAL_TEST:'true',PROMPTS_SUPABASE_URL:'http://127.0.0.1:56421'}).schema).toBe('prompt_preview');
  });
  it('sets fixed REST profiles and never sends them to Auth',async()=>{
    const fetcher=vi.fn(async()=>Response.json({}));
    await upstream('/rest/v1/rpc/portal_prompt_limit',{env:previewEnv,fetcher,token,method:'POST',data:{p_write:false}});
    await upstream('/auth/v1/user',{env:previewEnv,fetcher,token});
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({'Accept-Profile':'prompt_preview','Content-Profile':'prompt_preview'});
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty('Accept-Profile');
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty('Content-Profile');
  });
});
function setup(results=[],auth=false) {
  const fetcher=vi.fn(async(url)=>{
    if(url.endsWith('/auth/v1/user'))return Response.json(user);
    if(url.endsWith('/rest/v1/rpc/portal_prompt_limit'))return Response.json(null);
    const next=results.shift();return next instanceof Response ? next : Response.json(next ?? {});
  });
  const logger={info:vi.fn()};
  return {fetcher,logger,handler:(auth?createAuthHandler:createPromptsHandler)({env,fetcher,logger})};
}
async function request(handler,{method='GET',url='/api/prompts',body,headers={}}={}) {
  const req={method,url,headers:{authorization:'Bearer '+token,'content-type':'application/json',...headers},body};
  const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(raw){this.body=JSON.parse(raw);}};
  await handler(req,res);return res;
}
describe('prompt API boundary',()=>{
  it('rejects missing and forged authentication without a database call',async()=>{
    const {handler,fetcher}=setup();
    expect((await request(handler,{headers:{authorization:''}})).statusCode).toBe(401);expect(fetcher).not.toHaveBeenCalled();
    const forged=createPromptsHandler({env,fetcher:async()=>Response.json({}, {status:401}),logger:{info(){}}});
    expect((await request(forged)).statusCode).toBe(401);
  });
  it('rejects anonymous and unconfirmed users',async()=>{
    for(const u of [{...user,is_anonymous:true},{...user,email_confirmed_at:null}]) {
      const handler=createPromptsHandler({env,fetcher:async()=>Response.json(u),logger:{info(){}}});expect((await request(handler)).statusCode).toBe(401);
    }
  });
  it('forwards only a verified user token and limits list payloads',async()=>{
    const {handler,fetcher}=setup([[{id,updated_at:'2026-01-01'},{id,updated_at:'2026-01-01'}]]);
    const result=await request(handler,{url:'/api/prompts?limit=1&q=OOTD&favorite=true'});
    expect(result.statusCode).toBe(200);expect(result.body.items).toHaveLength(1);expect(result.body.next_cursor).toBeTruthy();
    const [url,options]=fetcher.mock.calls.find(([url])=>url.includes('portal_prompt_list'));expect(url).toContain('portal_prompt_list');expect(options.headers.authorization).toBe('Bearer '+token);
    expect(JSON.parse(options.body)).toMatchObject({p_query:'OOTD',p_favorite:true,p_limit:2});
    expect(result.headers['cache-control']).toContain('no-store');
  });
  it('rejects malformed query, wrong ids, unbounded lists and unknown input',async()=>{
    for(const url of ['/api/prompts?limit=999','/api/prompts?cursor=bad','/api/prompts?favorite=maybe','/api/prompts?owner_id=other','/api/prompts/not-uuid'])expect((await request(setup().handler,{url})).statusCode).toBe(400);
    const {handler}=setup();expect((await request(handler,{method:'POST',body:{title:'x',content:'x',request_id:id,owner_id:id}})).statusCode).toBe(400);
  });
  it('rejects oversized, invalid JSON and unsupported media',async()=>{
    const {handler}=setup();
    expect((await request(handler,{method:'POST',body:'{'})).statusCode).toBe(400);
    expect((await request(handler,{method:'POST',body:'x'.repeat(262145)})).statusCode).toBe(413);
    expect((await request(handler,{method:'POST',body:{},headers:{'content-type':'text/plain'}})).statusCode).toBe(415);
  });
  it('requires revision for PATCH and DELETE',async()=>{
    for(const method of ['PATCH','DELETE'])expect((await request(setup().handler,{method,url:'/api/prompts/'+id,body:{content:'new'}})).statusCode).toBe(400);
  });
  it('maps conflict, not found, deleted and rate limit without leaking DB errors',async()=>{
    for(const [code,status] of [['PT403',403],['PT409',409],['PT404',404],['PT410',410],['PT429',429]]) {
      const {handler}=setup([Response.json({code,message:'sensitive db detail'},{status:400})]);
      const r=await request(handler,{method:'DELETE',url:'/api/prompts/'+id,body:{version:1}});
      expect(r.statusCode).toBe(status);expect(JSON.stringify(r.body)).not.toContain('sensitive');
    }
  });
  it('never logs tokens, title or content',async()=>{
    const {handler,logger}=setup([{id,version:1}]);await request(handler,{method:'POST',body:{title:'private title',content:'private content',request_id:id}});
    const logs=JSON.stringify(logger.info.mock.calls);expect(logs).not.toContain(token);expect(logs).not.toContain('private');
  });
  it('fails closed when configuration is absent and reports disabled to the UI',async()=>{
    const logger={info(){}};
    expect((await request(createPromptsHandler({env:{},logger}))).statusCode).toBe(503);
    expect((await request(createAuthHandler({env:{},logger}),{url:'/api/prompt-auth/config'})).body).toEqual({enabled:false});
  });
  it('does not reveal provider details for invalid login',async()=>{
    const {handler}=setup([Response.json({error:'bad password'},{status:400})],true);
    const r=await request(handler,{method:'POST',url:'/api/prompt-auth/login',body:{email:'a@b.invalid',password:'bad'}});
    expect(r.statusCode).toBe(401);expect(JSON.stringify(r.body)).not.toContain('password');
  });
});
