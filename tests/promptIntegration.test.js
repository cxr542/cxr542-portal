import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { startPromptFixture } from '../scripts/prompts-qa-server.mjs';
import { preview,upload } from '../apps/prompt-actions/public/prompt-collection/js/migration.js';
let fixture,token;const previous=process.env.PROMPTS_QA;
async function call(path,method='GET',body){const r=await fetch(fixture.url+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error.code),{status:r.status});return data;}
beforeAll(async()=>{process.env.PROMPTS_QA='local';fixture=await startPromptFixture(0);const r=await call('/api/prompt-auth/login','POST',{email:'alice@example.invalid',password:'qa-password'});token=r.access_token;},30000);
afterAll(async()=>{await fixture?.close();if(previous===undefined)delete process.env.PROMPTS_QA;else process.env.PROMPTS_QA=previous;});
describe('HTTP -> handlers -> PostgreSQL migration contract',()=>{
 it('verifies normalized whitespace without altering the original, then retries idempotently',async()=>{
  const original={id:'whitespace',title:' Whitespace import ',body:'original content',description:' description ',category:' category ',tags:[' tag ']};
  const rows=await preview([original]);const api={create:p=>call('/api/prompts','POST',p),get:id=>call('/api/prompts/'+id)};
  await upload(rows,api);expect(rows[0].status).toBe('done');expect(rows[0].raw).toEqual(original);
  const replay=await preview([original]);await upload(replay,api);expect(replay[0].status).toBe('done');expect(replay[0].server_id).toBe(rows[0].server_id);
  const exported=await call('/api/prompts?include_content=true');expect(exported.items).toHaveLength(1);expect(exported.items[0]).toMatchObject({category:'category',description:'description',legacy:original});
 });
 it('returns full filtered content for the browser cache, without other-owner leakage',async()=>{
  const found=await call('/api/prompts?include_content=true&category=category&tags=tag');expect(found.items[0].content).toBe('original content');
  expect((await call('/api/prompts?include_content=true&category=NO_MATCH')).items).toHaveLength(0);
 });
 it('exposes owned tombstones only for explicit backups and blocks changed legacy replay in preview',async()=>{
  const active=(await call('/api/prompts?include_content=true')).items[0];
  await call('/api/prompts/'+active.id,'DELETE',{version:active.version});
  expect((await call('/api/prompts?include_content=true')).items).toHaveLength(0);
  const backup=(await call('/api/prompts?include_content=true&include_deleted=true')).items;
  expect(backup[0].deleted_at).toBeTruthy();
  const rows=await preview([{...backup[0].legacy,body:'older device edit',updatedAt:'2026-10-29'}],backup);
  expect(rows[0].status).toBe('deleted');expect(rows[0].selected).toBe(false);
  expect((await preview(backup))[0].status).toBe('deleted');
 });
});
