import { readFileSync, existsSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
const config=JSON.parse(readFileSync('vercel.json','utf8'));
describe('Vercel prompt routing before the SPA fallback',()=>{
  it.each([
    ['/api/prompts','/api/prompts/index','api/prompts/index.mjs'],
    ['/api/prompts/:id','/api/prompts/[id]?id=:id','api/prompts/[id].mjs'],
    ['/api/prompt-auth/:action','/api/prompt-auth/[action]?action=:action','api/prompt-auth/[action].mjs'],
    ['/api/prompt-oauth/:action','/api/prompt-oauth/[action]?action=:action','api/prompt-oauth/[action].mjs'],
  ])('routes %s directly to a function before the fallback', (source,destination,file)=>{
    const i=config.rewrites.findIndex(r=>r.source===source);
    expect(i).toBeGreaterThanOrEqual(0);expect(i).toBeLessThan(config.rewrites.findIndex(r=>r.source==='/(.*)'));
    expect(config.rewrites[i].destination).toBe(destination);expect(existsSync(file)).toBe(true);
  });
});
