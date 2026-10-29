import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
beforeEach(()=>{vi.resetModules();const values=new Map();vi.stubGlobal('sessionStorage',{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});vi.stubGlobal('indexedDB',new IDBFactory());});
afterEach(()=>vi.unstubAllGlobals());
describe('prompt cache and client sessions',()=>{
 it('isolates private drafts and caches by owner',async()=>{
  const {cache}=await import('../apps/prompt-actions/public/prompt-collection/js/cache.js');
  await cache.draft('alice',{draft_id:'one',title:'private'});await cache.draft('bob',{draft_id:'one',title:'other'});await cache.put('alice',[{id:'a'}]);
  expect((await cache.drafts('alice')).map(d=>d.title)).toEqual(['private']);expect((await cache.drafts('bob')).map(d=>d.title)).toEqual(['other']);expect(await cache.get('bob')).toBeUndefined();
 });
 it('refreshes an expired token once then retries the same request',async()=>{
  sessionStorage.setItem('prompt-central-session-v1',JSON.stringify({access_token:'expired',refresh_token:'refresh'}));
  const fetcher=vi.fn(async(path,options)=>path.includes('/refresh')?Response.json({access_token:'fresh',refresh_token:'new-refresh'}):options.headers.authorization==='Bearer fresh'?Response.json({id:'alice'}):Response.json({error:{code:'unauthorized'}},{status:401}));vi.stubGlobal('fetch',fetcher);
  const {api}=await import('../apps/prompt-actions/public/prompt-collection/js/api-client.js');expect(await api.user()).toEqual({id:'alice'});expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('does not restore a logged-out session when an old refresh returns',async()=>{
  sessionStorage.setItem('prompt-central-session-v1',JSON.stringify({access_token:'expired',refresh_token:'refresh'}));
  let release;let begun;const started=new Promise(r=>begun=r);
  vi.stubGlobal('fetch',async path=>path.includes('/refresh')?new Promise(resolve=>{release=()=>resolve(Response.json({access_token:'stale-result',refresh_token:'old'}));begun();}):Response.json({error:{code:'unauthorized'}},{status:401}));
  const {api}=await import('../apps/prompt-actions/public/prompt-collection/js/api-client.js');const pending=api.user().catch(e=>e);await started;
  const logout=api.logout();
  sessionStorage.removeItem('prompt-central-session-v1');
  // Complete the provider response; logout must still clear all local tokens.
  release();await logout.catch(()=>{});await pending;
  expect(api.hasSession()).toBe(false);expect(sessionStorage.getItem('prompt-central-session-v1')).toBeNull();
 });
});
