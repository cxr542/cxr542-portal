import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPromptsHandler } from '../server/prompts/handler.mjs';
import { createAuthHandler } from '../server/prompts/auth.mjs';
import { preview, upload } from '../apps/prompt-actions/public/prompt-collection/js/migration.js';

const root = '.cache/supabase-native';
const local = JSON.parse(readFileSync(root+'/status.json','utf8'));
assert.equal(local.API_URL,'http://127.0.0.1:56421','Only the dedicated loopback Supabase is allowed.');
assert.ok(local.PUBLISHABLE_KEY?.startsWith('sb_publishable_'));
const schema = process.env.PROMPTS_NATIVE_SCHEMA || 'public';
assert.ok(['public','prompt_preview'].includes(schema));
const env = {NODE_ENV:'test',PROMPTS_LOCAL_TEST:'true',PROMPTS_ENABLED:'true',PROMPTS_DB_SCHEMA:schema,PROMPTS_SUPABASE_URL:local.API_URL,PROMPTS_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY};
function membership(id,allowed) {
  assert.match(id,/^[0-9a-f-]{36}$/);
  const sql=allowed ? `INSERT INTO prompt_preview_private.test_users VALUES('${id}')` : `DELETE FROM prompt_preview_private.test_users WHERE owner_id='${id}'`;
  execFileSync('docker',['exec','-i','supabase_db_cxr542-prompts-native-20261028','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
}
const deps = {env,logger:{info(){}}};
const prompts = createPromptsHandler(deps), auth = createAuthHandler(deps);
const server = createServer((req,res) => req.url.startsWith('/api/prompt-auth/') ? auth(req,res) : prompts(req,res));
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:'+server.address().port;
const results = [];
async function run(name,fn) { await fn(); results.push({name,pass:true}); console.info('PASS '+name); }
async function api(token,path,method='GET',data) {
  const response = await fetch(origin+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  return {status:response.status,body:await response.json()};
}
async function native(path,{token=local.SERVICE_ROLE_KEY,method='GET',data}={}) {
  const r = await fetch(local.API_URL+path,{method,headers:{apikey:local.PUBLISHABLE_KEY,authorization:'Bearer '+token,'content-type':'application/json',...(path.startsWith('/rest/v1/')?{'Accept-Profile':schema,'Content-Profile':schema}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  return {status:r.status,body:await r.json().catch(()=>null)};
}
const accounts = [];
let a,b,prompt,raw;
try {
  await run('real Auth creates two isolated confirmed test accounts',async()=>{
    for(const label of ['alice','bob']) {
      const password = randomBytes(24).toString('base64url');
      const email = `prompt-${label}-${randomUUID()}@example.invalid`;
      const created = await native('/auth/v1/admin/users',{method:'POST',data:{email,password,email_confirm:true}});
      assert.equal(created.status,200,'Local Auth admin user creation');
      if(schema==='prompt_preview')membership(created.body.id,true);
      const login = await api(null,'/api/prompt-auth/login','POST',{email,password});
      assert.equal(login.status,200,'Portal login via real Auth');
      accounts.push({id:created.body.id,email,password,...login.body});
    }
    [a,b] = accounts;
    assert.equal((await api(a.access_token,'/api/prompt-auth/session')).body.id,a.id);
  });
  if(schema==='prompt_preview')await run('native preview rejects nonmembers and immediately enforces membership revocation',async()=>{
    const email=`outside-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
    assert.equal((await native('/auth/v1/admin/users',{method:'POST',data:{email,password,email_confirm:true}})).status,200);
    const login=await api(null,'/api/prompt-auth/login','POST',{email,password});
    assert.equal(login.status,200);
    assert.equal((await api(login.body.access_token,'/api/prompts')).status,403);
    const denied=await native('/rest/v1/portal_prompts?select=id',{token:login.body.access_token});
    assert.equal(denied.status,200);assert.deepEqual(denied.body,[]);
    membership(a.id,false);
    try{assert.equal((await api(a.access_token,'/api/prompts')).status,403);}finally{membership(a.id,true);}
  });
  await run('missing and forged bearer tokens are rejected by real Auth',async()=>{
    assert.equal((await api(null,'/api/prompts')).status,401);
    assert.equal((await api('forged-native-token-not-a-real-jwt','/api/prompts')).status,401);
  });
  const request = {request_id:randomUUID(),title:'OOTD native CRUD',content:'Native Supabase content',category:'이미지 생성',tags:['OOTD','Art Toy'],favorite:true,source:'cli'};
  await run('PostgREST RPC create, search and idempotent replay',async()=>{
    const r = await api(a.access_token,'/api/prompts','POST',request);
    assert.equal(r.status,201); prompt=r.body; assert.equal(prompt.owner_id,a.id);
    assert.equal((await api(a.access_token,'/api/prompts','POST',request)).body.id,prompt.id);
    assert.equal((await api(a.access_token,'/api/prompts','POST',{...request,content:'different'})).status,409);
    const list = await api(a.access_token,'/api/prompts?q=OOTD&category='+encodeURIComponent('이미지 생성')+'&tags=Art%20Toy&favorite=true');
    assert.equal(list.status,200); assert.equal(list.body.items.length,1);
  });
  await run('real RLS denies other-owner reads, mutations and direct writes',async()=>{
    assert.equal((await api(b.access_token,'/api/prompts')).body.items.length,0);
    for(const [method,data] of [['GET',undefined],['PATCH',{version:1,content:'attack'}],['DELETE',{version:1}]])assert.equal((await api(b.access_token,'/api/prompts/'+prompt.id,method,data)).status,404);
    const direct = await native('/rest/v1/portal_prompts?select=id',{token:b.access_token});
    assert.equal(direct.status,200); assert.deepEqual(direct.body,[]);
    assert.equal((await native('/rest/v1/portal_prompts?id=eq.'+prompt.id,{token:a.access_token,method:'PATCH',data:{owner_id:b.id}})).status,403);
    assert.equal((await api(a.access_token,'/api/prompts','POST',{...request,request_id:randomUUID(),owner_id:b.id})).status,400);
  });
  await run('two real concurrent PostgREST transactions yield one winner and one 409',async()=>{
    const outcomes = await Promise.all(['device A','device B'].map(content=>api(a.access_token,'/api/prompts/'+prompt.id,'PATCH',{version:1,content})));
    assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
    const detail=await api(a.access_token,'/api/prompts/'+prompt.id); assert.equal(detail.body.version,2);
  });
  await run('legacy upload uses real Auth/REST and verifies normalized content',async()=>{
    raw={...JSON.parse(readFileSync('tests/fixtures/ootd.json','utf8')),id:'native-'+randomUUID(),description:' description ',category:' 이미지 생성 '};
    const rows=await preview([raw]);
    const client={async create(data){const r=await api(a.access_token,'/api/prompts','POST',data);if(r.status!==201)throw Object.assign(new Error('create rejected'),{status:r.status});return r.body;},async get(id){const r=await api(a.access_token,'/api/prompts/'+id);assert.equal(r.status,200);return r.body;}};
    await upload(rows,client);assert.equal(rows[0].status,'done');
    const again=await preview([raw]);await upload(again,client);assert.equal(again[0].server_id,rows[0].server_id);
    prompt=await client.get(rows[0].server_id);
    const backup=await api(a.access_token,'/api/prompts?include_content=true');
    assert.deepEqual(backup.body.items.find(p=>p.id===prompt.id).legacy,raw);
  });
  await run('native tombstone prevents stale cache and migration resurrection',async()=>{
    assert.equal((await api(a.access_token,'/api/prompts/'+prompt.id,'DELETE',{version:1})).status,200);
    assert.equal((await api(a.access_token,'/api/prompts/'+prompt.id)).status,404);
    assert.equal((await api(a.access_token,'/api/prompts/'+prompt.id,'PATCH',{version:2,content:'revive'})).status,404);
    const old=await preview([raw]);
    const replay=await api(a.access_token,'/api/prompts','POST',{...old[0].data,request_id:old[0].request_id,legacy:raw});assert.equal(replay.status,410);
    const backup=await api(a.access_token,'/api/prompts?include_content=true&include_deleted=true');
    assert.equal((await preview([{...raw,body:'old device change'}],backup.body.items))[0].status,'deleted');
  });
  await run('native token expiry is enforced independently of signature validation',async()=>{
    const payload=JSON.parse(Buffer.from(a.access_token.split('.')[1],'base64url'));
    const sign=exp=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const p=Buffer.from(JSON.stringify({...payload,iat:Math.floor(Date.now()/1000)-120,exp})).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',local.JWT_SECRET).update(h+'.'+p).digest('base64url');};
    assert.equal((await native('/auth/v1/user',{token:sign(Math.floor(Date.now()/1000)+60)})).status,200);
    assert.equal((await api(sign(Math.floor(Date.now()/1000)-60),'/api/prompts')).status,401);
  });
  await run('real refresh works and logout revokes the refresh session',async()=>{
    const refreshed=await api(null,'/api/prompt-auth/refresh','POST',{refresh_token:b.refresh_token});assert.equal(refreshed.status,200);
    assert.equal((await api(refreshed.body.access_token,'/api/prompt-auth/session')).body.id,b.id);
    assert.equal((await api(refreshed.body.access_token,'/api/prompt-auth/logout','POST')).status,200);
    assert.equal((await api(null,'/api/prompt-auth/refresh','POST',{refresh_token:refreshed.body.refresh_token})).status,401);
  });
  writeFileSync(root+'/accounts.json',JSON.stringify(accounts),{mode:0o600});
  writeFileSync(root+(schema==='public'?'/results.json':'/preview-results.json'),JSON.stringify({engine:'Native Supabase Auth + PostgREST + PostgreSQL',schema,loopbackOnly:true,cloudMutations:false,results},null,2));
  console.info(JSON.stringify({passed:results.length,cloudMutations:false}));
} finally { await new Promise(resolve=>server.close(resolve)); }
