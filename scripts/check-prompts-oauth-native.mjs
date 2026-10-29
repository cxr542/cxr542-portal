import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createOAuthHandler } from '../server/prompts/oauth.mjs';
import { createAuthHandler } from '../server/prompts/auth.mjs';
import { createPromptsHandler } from '../server/prompts/handler.mjs';

const root='.cache/supabase-native';
const local=JSON.parse(readFileSync(root+'/status.json','utf8'));
assert.equal(local.API_URL,'http://127.0.0.1:56421','Only dedicated local Supabase is allowed');
const callback='https://client.invalid/callback';
const env={NODE_ENV:'test',PROMPTS_LOCAL_TEST:'true',PROMPTS_ENABLED:'true',PROMPTS_SUPABASE_URL:local.API_URL,PROMPTS_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,PROMPTS_OAUTH_ENABLED:'true',PROMPTS_PUBLIC_ORIGIN:'https://portal.invalid',PROMPTS_OAUTH_REDIRECT_URIS:callback};
const deps={env,logger:{info(){}}};
const oauth=createOAuthHandler(deps),auth=createAuthHandler(deps),prompts=createPromptsHandler(deps);
const server=createServer((req,res)=>req.url.startsWith('/api/prompt-oauth/')?oauth(req,res):req.url.startsWith('/api/prompt-auth/')?auth(req,res):prompts(req,res));
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
const results=[];
async function run(name,fn){await fn();results.push({name,pass:true});console.info('PASS '+name);}
async function native(path,method='GET',data,token=local.SERVICE_ROLE_KEY){
 const r=await fetch(local.API_URL+path,{method,headers:{apikey:local.PUBLISHABLE_KEY,authorization:'Bearer '+token,'content-type':'application/json'},redirect:'manual',...(data===undefined?{}:{body:JSON.stringify(data)})});
 return{status:r.status,location:r.headers.get('location'),body:await r.json().catch(()=>null)};
}
async function api(path,{method='GET',data,token,basic}={}){
 const r=await fetch(origin+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(basic?{authorization:'Basic '+Buffer.from(basic).toString('base64')}:{})},redirect:'manual',...(data===undefined?{}:{body:JSON.stringify(data)})});
 return{status:r.status,location:r.headers.get('location'),body:await r.json().catch(()=>null)};
}
let client,user,session;
function params(){const verifier=randomBytes(32).toString('base64url');const state=randomBytes(24).toString('base64url');return{verifier,state,query:new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',state,scope:'email profile',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'})};}
async function authorize(){
 const p=params();const r=await api('/api/prompt-oauth/authorize?'+p.query);assert.equal(r.status,303,'Native authorize through portal proxy');
 const consent=new URL(r.location);assert.equal(consent.origin,'https://portal.invalid');assert.equal(consent.pathname,'/prompt-collection/index.html');
 return{...p,id:consent.searchParams.get('authorization_id')};
}
async function decide(flow,decision){const r=await api('/api/prompt-oauth/consent',{method:'POST',token:session.access_token,data:{authorization_id:flow.id,decision}});assert.equal(r.status,200,'Native consent through proxy');const target=new URL(r.body.redirect_url);assert.equal(target.origin,new URL(callback).origin);assert.equal(target.pathname,'/callback');assert.equal(target.searchParams.get('state'),flow.state);return target;}
const exchange=(flow,code,extra={})=>api('/api/prompt-oauth/token',{method:'POST',data:{grant_type:'authorization_code',client_id:client.client_id,client_secret:client.client_secret,redirect_uri:callback,code_verifier:flow.verifier,code,...extra}});
try{
 await run('native OAuth creates a confidential client and confirmed local test user',async()=>{
  const registered=await native('/auth/v1/admin/oauth/clients','POST',{client_name:'Prompt OAuth local pilot',redirect_uris:[callback],client_type:'confidential',token_endpoint_auth_method:'client_secret_post'});
  assert.equal(registered.status,201,'Local OAuth client creation');client=registered.body;assert.ok(client.client_secret);env.PROMPTS_OAUTH_CLIENT_ID=client.client_id;
  const password=randomBytes(24).toString('base64url')+'Ab9!',email='oauth-'+randomUUID()+'@example.invalid';
  const created=await native('/auth/v1/admin/users','POST',{email,password,email_confirm:true});assert.equal(created.status,200);user=created.body;
  const login=await api('/api/prompt-auth/login',{method:'POST',data:{email,password}});assert.equal(login.status,200);session=login.body;
 });
 await run('OAuth proxy rejects missing PKCE and state against native configuration',async()=>{
  for(const field of ['code_challenge','state']){const p=params();p.query.delete(field);assert.equal((await api('/api/prompt-oauth/authorize?'+p.query)).status,400);}
 });
 await run('native authorization details are bound to the registered client and account',async()=>{
  const flow=await authorize();const r=await api('/api/prompt-oauth/details',{method:'POST',token:session.access_token,data:{authorization_id:flow.id}});
  if(r.status!==200){const direct=await native('/auth/v1/oauth/authorizations/'+encodeURIComponent(flow.id),'GET',undefined,session.access_token);console.info(JSON.stringify({authorizationIdLength:flow.id?.length,idIsHex:/^[0-9a-f]+$/i.test(flow.id||''),proxyError:r.body?.error,directStatus:direct.status,directFields:Object.keys(direct.body||{}),clientFields:Object.keys(direct.body?.client||{})}));}
  assert.equal(r.status,200,'Native details through portal proxy');assert.equal(r.body.name,'Prompt OAuth local pilot');assert.equal(r.body.redirect_uri,callback);
  const redirect=await decide(flow,'deny');assert.equal(redirect.searchParams.get('error'),'access_denied');
 });
 await run('native consent approval and PKCE exchange yield an account-scoped token',async()=>{
  const flow=await authorize();const redirect=await decide(flow,'approve');const code=redirect.searchParams.get('code');assert.ok(code);
  const r=await exchange(flow,code);assert.equal(r.status,200,'Native OAuth code exchange');assert.ok(r.body.access_token);session.oauth=r.body;
  assert.equal((await api('/api/prompt-auth/session',{token:r.body.access_token})).body.id,user.id);
  const payload=JSON.parse(Buffer.from(r.body.access_token.split('.')[1],'base64url'));assert.equal(payload.client_id,client.client_id);
  assert.equal((await exchange(flow,code)).status,401,'Authorization code cannot be replayed');
 });
 await run('native OAuth bearer token uses the existing prompt API and owner checks',async()=>{
  const r=await api('/api/prompts',{method:'POST',token:session.oauth.access_token,data:{request_id:randomUUID(),title:'Local OAuth pilot',content:'Not production data',source:'chatgpt'}});assert.equal(r.status,201);assert.equal(r.body.owner_id,user.id);
  assert.equal((await api('/api/prompts/'+r.body.id,{method:'DELETE',token:session.oauth.access_token,data:{version:r.body.version}})).status,200);
 });
 await run('native OAuth refresh preserves account identity and returns no client secret',async()=>{
  const r=await api('/api/prompt-oauth/token',{method:'POST',data:{grant_type:'refresh_token',client_id:client.client_id,client_secret:client.client_secret,refresh_token:session.oauth.refresh_token}});assert.equal(r.status,200);assert.ok(r.body.access_token);assert.ok(!('client_secret' in r.body));
  assert.equal((await api('/api/prompt-auth/session',{token:r.body.access_token})).body.id,user.id);
 });
 await run('native token exchange rejects wrong verifier and wrong client secret',async()=>{
  for(const extra of [{code_verifier:randomBytes(32).toString('base64url')},{client_secret:'wrong-secret-for-local-test'}]){const flow=await authorize();const target=await decide(flow,'approve');assert.equal((await exchange(flow,target.searchParams.get('code'),extra)).status,401);}
 });
 await run('native confidential client supports HTTP Basic code exchange and refresh',async()=>{
  const registered=await native('/auth/v1/admin/oauth/clients','POST',{client_name:'Prompt OAuth Basic pilot',redirect_uris:[callback],client_type:'confidential',token_endpoint_auth_method:'client_secret_basic'});assert.equal(registered.status,201);client=registered.body;env.PROMPTS_OAUTH_CLIENT_ID=client.client_id;
  const flow=await authorize(),target=await decide(flow,'approve');
  const basic=client.client_id+':'+client.client_secret;
  const r=await api('/api/prompt-oauth/token',{method:'POST',basic,data:{grant_type:'authorization_code',redirect_uri:callback,code_verifier:flow.verifier,code:target.searchParams.get('code')}});assert.equal(r.status,200);
  assert.equal((await api('/api/prompt-auth/session',{token:r.body.access_token})).body.id,user.id);
  const refreshed=await api('/api/prompt-oauth/token',{method:'POST',basic,data:{grant_type:'refresh_token',refresh_token:r.body.refresh_token}});assert.equal(refreshed.status,200);
 });
 writeFileSync(root+'/oauth-results.json',JSON.stringify({engine:'Native local Supabase OAuth Server + portal proxy',cloudOAuthChanged:false,chatgptClientTested:false,results},null,2));console.info(JSON.stringify({passed:results.length}));
}finally{await new Promise(resolve=>server.close(resolve));}
