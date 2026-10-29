import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const target=process.env.PROMPTS_BUNDLE_TARGET||'preview';
if(!['preview','production'].includes(target))throw new Error('Unsupported bundle target');
const schema=target==='production'?'public':'prompt_preview';
const root=resolve(target==='production'?'.cache/prompt-actions-production':'.cache/prompt-actions-pilot');
const pilotOrigin=process.env.PROMPTS_PILOT_ORIGIN||'https://pilot-origin-required.invalid';
const parsedOrigin=new URL(pilotOrigin);
if(parsedOrigin.protocol!=='https:'||parsedOrigin.origin!==pilotOrigin||parsedOrigin.username||parsedOrigin.password)throw new Error('Use a canonical HTTPS pilot origin');
const marker=join(root,'.prompt-pilot-bundle');
if(existsSync(root)) {
  if(!existsSync(marker)||readFileSync(marker,'utf8')!=='cxr542-prompt-actions-pilot\n')throw new Error('Refusing to replace an unmanaged directory');
  rmSync(root,{recursive:true});
}
if(!existsSync('.cache/prompt-actions-assets/public/prompt-collection/index.html'))throw new Error('Run npm run build:prompt-actions first');
mkdirSync(root,{recursive:true});writeFileSync(marker,'cxr542-prompt-actions-pilot\n');
for(const [from,to] of [
 ['.cache/prompt-actions-assets/public/prompt-collection','public/prompt-collection'],
 ['public/shared/css/project-shell.css','public/shared/css/project-shell.css'],
 ['public/shared/js/project-shell.js','public/shared/js/project-shell.js'],
 ['public/favicon.svg','public/favicon.svg'],
 ['api/prompt-mcp.mjs','api/prompt-mcp.mjs'], ['api/prompts','api/prompts'],['api/prompt-auth','api/prompt-auth'],['api/prompt-oauth','api/prompt-oauth'],
 ...['http','handler','validation','auth','oauth','mcp'].map(n=>[`server/prompts/${n}.mjs`,`server/prompts/${n}.mjs`]),
]){mkdirSync(dirname(join(root,to)),{recursive:true});cpSync(from,join(root,to),{recursive:true});}
writeFileSync(join(root,'server/prompts/pilot-only.mjs'),`export function pilotOnly(handler) {
  return (req,res) => {
    if(process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== '${target}' || process.env.PROMPTS_DB_SCHEMA !== '${schema}') {
      res.statusCode=503; res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
      res.end(JSON.stringify({error:{code:'pilot_not_configured'}})); return;
    }
    return handler(req,res);
  };
}
`);
for(const [file,module] of [['api/prompts/index.mjs','handler'],['api/prompts/[id].mjs','handler'],['api/prompt-auth/[action].mjs','auth'],['api/prompt-oauth/[action].mjs','oauth']]) {
  const handler=file==='api/prompts/index.mjs'?'(req,res)=>{req.promptCollection=true;return handler(req,res);}':'handler';
  writeFileSync(join(root,file),`import handler from '../../server/prompts/${module}.mjs';\nimport {pilotOnly} from '../../server/prompts/pilot-only.mjs';\nexport default pilotOnly(${handler});\n`);
}
writeFileSync(join(root,'api/prompt-mcp.mjs'),`import handler from '../server/prompts/mcp.mjs';\nimport {pilotOnly} from '../server/prompts/pilot-only.mjs';\nexport default pilotOnly(handler);\n`);
if(target==='production') {
  const shellPath=join(root,'public/shared/js/project-shell.js');
  const shell=readFileSync(shellPath,'utf8');
  const expected='var PRODUCTION_HOSTS = { "cxr542-portal.vercel.app": true };';
  if(!shell.includes(expected))throw new Error('Review environment badge before production packaging');
  writeFileSync(shellPath,shell.replace(expected,`var PRODUCTION_HOSTS = { "cxr542-portal.vercel.app": true, ${JSON.stringify(parsedOrigin.hostname)}: true };`));
}
const htmlPath=join(root,'public/prompt-collection/index.html');
writeFileSync(htmlPath,readFileSync(htmlPath,'utf8').replaceAll('href="/"','href="https://cxr542-portal.vercel.app/"'));
writeFileSync(join(root,'package.json'),JSON.stringify({name:'cxr542-prompt-actions-pilot',private:true,type:'module',engines:{node:'24.x'},dependencies:{'@modelcontextprotocol/sdk':'1.32.2'},overrides:{zod:'4.6.7'}},null,2)+'\n');
const original=JSON.parse(readFileSync('vercel.json','utf8'));
writeFileSync(join(root,'vercel.json'),JSON.stringify({version:2,outputDirectory:'public',redirects:[{source:'/',destination:'/prompt-collection/index.html',permanent:false}],rewrites:original.rewrites.filter(r=>r.source==='/api/prompt-mcp'||r.source==='/.well-known/oauth-protected-resource/api/prompt-mcp'||r.source.startsWith('/api/prompts')||r.source.startsWith('/api/prompt-auth/')||r.source.startsWith('/api/prompt-oauth/'))},null,2)+'\n');
writeFileSync(join(root,'.vercelignore'),'.vercel/\n.env*\n.prompt-pilot-bundle\nmanifest.json\n');
// The schema is published only after the actual deployment URL is known.
const specPath=join(root,'public/prompt-collection/openapi.json');
const spec=JSON.parse(readFileSync(specPath,'utf8'));
spec.servers=[{url:pilotOrigin}];
const schemes=Object.values(spec.components.securitySchemes).filter(s=>s.type==='oauth2'&&s.flows?.authorizationCode);
if(schemes.length!==1)throw new Error('Review the Action OAuth schema before packaging');
schemes[0].flows.authorizationCode.authorizationUrl=pilotOrigin+'/api/prompt-oauth/authorize';
schemes[0].flows.authorizationCode.tokenUrl=pilotOrigin+'/api/prompt-oauth/token';
writeFileSync(specPath,JSON.stringify(spec,null,2)+'\n');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name).slice(root.length+1)]);}
const list=files(root);
if(list.some(p=>/(^|\/)(\.env[^/]*|accounts\.json|status\.json|sessions\.json|development\.env)$/.test(p)))throw new Error('Credential file in pilot bundle');
writeFileSync(join(root,'manifest.json'),JSON.stringify({purpose:'Local review only; no cloud resources created',projectCandidate:'cxr542-prompt-actions-pilot',target,files:list},null,2)+'\n');
console.info(JSON.stringify({directory:root,files:list.length,deployed:false}));
