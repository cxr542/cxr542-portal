import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createPromptTransport } from '../src/cloud/promptTransport.js';
function adapter(api) { const c={PortalPromptApi:api,crypto:webcrypto,TextEncoder,Date,console};c.window=c;vm.runInNewContext(fs.readFileSync('public/prompt-collection/js/db.js','utf8'),c);return c.PromptCollectionDb; }
describe('latest portal prompt bridge',()=>{
 it('routes legacy migration to the dedicated API and refuses tombstones',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{access_token:'x'}}})}};
  const fetcher=vi.fn().mockImplementation(async()=>Response.json({id:'saved'}));
  const t=createPromptTransport(client,fetcher), raw={id:'old',title:'Legacy',body:'full',pinned:true};
  await t.importLegacy(raw);await t.importLegacy(raw);
  const a=JSON.parse(fetcher.mock.calls[0][1].body),b=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(a.request_id).toBe(b.request_id);expect(a.legacy).toEqual(raw);expect(a.source).toBe('legacy_import');
  await expect(t.importLegacy({...raw,deleted_at:'2026-10-29'})).rejects.toThrow('삭제');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('reuses the portal session for every request and never substitutes another owner',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({items:[{id:'a'}],next_cursor:null}));
  const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{access_token:'owner-session'}}})}};
  const transport=createPromptTransport(client,fetcher);expect(await transport.list()).toEqual([{id:'a'}]);
  expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer owner-session');
  transport.stop();await expect(transport.list()).rejects.toThrow('종료');expect(transport.snapshot()).toEqual([]);
 });
 it('paginates full content and rejects authentication and version conflicts',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{access_token:'x'}}})}};
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({items:[{id:'one',content:'full'}],next_cursor:'next'})).mockResolvedValueOnce(Response.json({items:[{id:'two'}],next_cursor:null})).mockResolvedValueOnce(Response.json({error:{code:'conflict'}},{status:409}));
  const t=createPromptTransport(client,fetcher);expect(await t.list()).toHaveLength(2);expect(fetcher.mock.calls[1][0]).toContain('cursor=next');await expect(t.request('/api/prompts/one','PATCH',{})).rejects.toThrow('다른 곳');
 });
 it('keeps the editor revision and hidden metadata when saving',async()=>{
  const row={id:'p',title:'Title',content:'full',favorite:true,category:'image',tags:['art'],version:4};
  const api={request:vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce({...row,version:5}),changed:vi.fn(),list:async()=>[row]};
  const db=adapter(api), draft=await db.getPrompt('p');draft.body='edited';await db.putPrompt(draft);
  expect(api.request.mock.calls[1]).toEqual(['/api/prompts/p','PATCH',expect.objectContaining({version:4,category:'image',tags:['art'],content:'edited',favorite:true})]);expect(draft.version).toBe(5);
 });
 it('uses one stable create request ID on retry and guards stale deletion',async()=>{
  const api={request:vi.fn().mockRejectedValue(new Error('offline')),changed:vi.fn()};const db=adapter(api),draft={title:'new',body:'text'};
  await expect(db.putPrompt(draft)).rejects.toThrow();await expect(db.putPrompt(draft)).rejects.toThrow();expect(api.request.mock.calls[0][2].request_id).toBe(api.request.mock.calls[1][2].request_id);
  await expect(db.deletePrompt('p')).rejects.toThrow('다시');expect(api.request).toHaveBeenCalledTimes(2);
 });
 it('imports idempotently without clearing existing records or losing the raw original',async()=>{
  const api={request:vi.fn().mockResolvedValue({}),changed:vi.fn()};const db=adapter(api);const data={prompts:[{id:'old',title:'Legacy',body:'original',tags:['tag']}]};
  await db.importPayload(data,false);await db.importPayload(data,false);
  expect(api.request.mock.calls[0][2].request_id).toBe(api.request.mock.calls[1][2].request_id);expect(api.request.mock.calls[0][2].legacy).toEqual(data.prompts[0]);await expect(db.importPayload(data,true)).rejects.toThrow('전체 삭제');
 });
});
