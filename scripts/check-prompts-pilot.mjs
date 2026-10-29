import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve('.cache/prompt-actions-pilot');
const {files}=JSON.parse(readFileSync(root+'/manifest.json','utf8'));
assert.ok(!files.some(p=>/^(src|docs|tests|supabase|\.env|\.cache)\//.test(p)));
assert.ok(files.filter(p=>p.startsWith('public/')).every(p=>p.startsWith('public/prompt-collection/')||p.startsWith('public/shared/')||p==='public/favicon.svg'));
for(const name of files.filter(p=>p.endsWith('.mjs')||p.endsWith('.js'))) {
 const text=readFileSync(root+'/'+name,'utf8');
 for(const match of text.matchAll(/^\s*import\s+(?:[^'";\n]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
  const target=match[1].split('?')[0];
  if(target.startsWith('node:'))continue;
  if(target.startsWith('@modelcontextprotocol/sdk/'))continue;
  assert.ok(target.startsWith('.')||target.startsWith('/'),'Unexpected external dependency');
  const path=target.startsWith('/')?root+'/public'+target:resolve(dirname(root+'/'+name),target);
  assert.ok(existsSync(path),'Missing bundled import: '+name+' -> '+target);
 }
}
const config=JSON.parse(readFileSync(root+'/vercel.json','utf8'));
assert.equal(config.rewrites.length,6);
assert.ok(config.rewrites.every(r=>/^\/api\/(prompts|prompt-auth|prompt-oauth|prompt-mcp)/.test(r.source)||r.source==='/.well-known/oauth-protected-resource/api/prompt-mcp'));
const handlers=[];
for(const name of files.filter(p=>p.startsWith('api/')&&p.endsWith('.mjs')))handlers.push((await import(pathToFileURL(root+'/'+name))).default);
const keys=['VERCEL','VERCEL_ENV','PROMPTS_DB_SCHEMA','PROMPTS_ENABLED'];
const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try {
 for(const settings of [{VERCEL:'1',VERCEL_ENV:'production',PROMPTS_DB_SCHEMA:'prompt_preview'},{VERCEL:'1',VERCEL_ENV:'preview',PROMPTS_DB_SCHEMA:'public'},{VERCEL:'',VERCEL_ENV:'preview',PROMPTS_DB_SCHEMA:'prompt_preview'}]) {
  Object.assign(process.env,settings);
  for(const handler of handlers){const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await handler({url:'/api/prompts',method:'GET',headers:{}},res);assert.equal(res.statusCode,503);assert.equal(res.body.error.code,'pilot_not_configured');}
 }
 Object.assign(process.env,{VERCEL:'1',VERCEL_ENV:'preview',PROMPTS_DB_SCHEMA:'prompt_preview',PROMPTS_ENABLED:'false'});
 const auth=(await import(pathToFileURL(root+'/api/prompt-auth/[action].mjs'))).default;
 const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};
 await auth({url:'/api/prompt-auth/config',method:'GET',headers:{}},res);assert.equal(res.statusCode,200);assert.equal(res.body.enabled,false);
} finally {for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
console.info(JSON.stringify({pass:true,files:files.length,privateFilesExcluded:true,allImportsResolved:true,wrongEnvironmentOrSchemaBlocked:true,deployed:false}));
