import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const target = process.env.PROMPTS_BUNDLE_TARGET || 'preview';
assert.ok(['preview', 'production'].includes(target));
const root = resolve(target === 'production' ? '.cache/prompt-actions-production' : '.cache/prompt-actions-pilot');
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
const keys = ['VERCEL', 'VERCEL_ENV', 'PORTAL_DATA_MODE', 'PROMPTS_DB_SCHEMA', 'PROMPTS_ENABLED'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const deployEnv = {
  VERCEL: '1',
  VERCEL_ENV: target,
  PORTAL_DATA_MODE: target === 'preview' ? 'mock' : '',
  PROMPTS_DB_SCHEMA: target === 'preview' ? 'prompt_preview' : 'public',
  PROMPTS_ENABLED: 'false',
};
const response = () => ({ setHeader() {}, end(raw) { this.body = JSON.parse(raw); } });
try {
  for (const changes of [
    { VERCEL_ENV: target === 'preview' ? 'production' : 'preview' },
    { PROMPTS_DB_SCHEMA: target === 'preview' ? 'public' : 'prompt_preview' },
    { VERCEL: '' },
  ]) {
    Object.assign(process.env, deployEnv, changes);
    for (const handler of handlers) {
      const res = response();
      await handler({ url: '/api/prompts', method: 'GET', headers: {} }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.error.code, 'pilot_not_configured');
    }
  }
  Object.assign(process.env, deployEnv);
  if (target === 'preview') {
    for (const [mode, status, code] of [
      ['mock', 403, 'mock_live_access_denied'],
      ['supabase', 503, 'invalid_configuration'],
      ['', 503, 'invalid_configuration'],
    ]) {
      process.env.PORTAL_DATA_MODE = mode;
      for (const handler of handlers) {
        const res = response();
        await handler({ url: '/api/prompts', method: 'GET', headers: {} }, res);
        assert.equal(res.statusCode, status);
        assert.equal(res.body.error.code, code);
      }
    }
  } else {
    const auth = (await import(pathToFileURL(root + '/api/prompt-auth/[action].mjs'))).default;
    const res = response();
    await auth({ url: '/api/prompt-auth/config', method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.enabled, false);
  }
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}
console.info(JSON.stringify({ pass: true, target, files: files.length, handlers: handlers.length, deployed: false }));
