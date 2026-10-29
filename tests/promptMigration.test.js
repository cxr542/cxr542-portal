import fs from 'node:fs';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { canonical, normalize, payloadRows, preview, requestId, upload } from '../apps/prompt-actions/public/prompt-collection/js/migration.js';
const sample=JSON.parse(fs.readFileSync('tests/fixtures/ootd.json','utf8'));
function legacy(indexedDB=new IDBFactory(), raw=JSON.stringify([sample])) {
  const values=new Map([['prompt-collection-prompts',raw]]);
  const context={ indexedDB,Promise,Date,Math,console,location:{origin:'https://fixture.invalid'},localStorage:{ getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) } };
  context.window=context;
  vm.runInNewContext(fs.readFileSync('apps/prompt-actions/public/prompt-collection/js/db.js','utf8'),context);
  return { db:context.PromptCollectionDb,values,indexedDB };
}
async function seed(factory) {
  await new Promise((resolve,reject)=>{const r=factory.open('prompt-collection',1);r.onupgradeneeded=()=>r.result.createObjectStore('prompts',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{const tx=r.result.transaction('prompts','readwrite');tx.objectStore('prompts').put({...sample,id:'idb-record',unknown:'preserve'});tx.oncomplete=()=>{r.result.close();resolve();};};});
}
describe('legacy preservation and migration',()=>{
  it('reads both stores without modifying either, preserving unknown fields',async()=>{
    const fixture=legacy();await seed(fixture.indexedDB);
    const raw=fixture.values.get('prompt-collection-prompts');
    const backup=await fixture.db.readLegacy();
    expect(backup.indexeddb[0].unknown).toBe('preserve');expect(backup.localstorage[0]).toEqual(sample);
    expect(fixture.values.get('prompt-collection-prompts')).toBe(raw);
    expect((await fixture.db.readLegacy()).indexeddb).toEqual(backup.indexeddb);
  });
  it('does not create or seed a missing original database',async()=>{
    const fixture=legacy();await fixture.db.readLegacy();
    expect(await fixture.indexedDB.databases()).toEqual([]);
  });
  it('rejects malformed local originals rather than silently replacing them with empty data',async()=>{
    const fixture=legacy(new IDBFactory(),'bad json');
    expect(()=>fixture.db.readLegacy()).toThrow();expect(fixture.values.get('prompt-collection-prompts')).toBe('bad json');
  });
  it('disallows legacy destructive replacement',async()=>{
    await expect(legacy().db.importPayload({prompts:[]},true)).rejects.toThrow('원본 교체');
  });
  it('retains OOTD text, tags, favorite and stable migration identifiers',async()=>{
    expect(normalize(sample)).toMatchObject({content:sample.body,tags:sample.tags,favorite:true,category:'이미지 생성'});
    expect(await requestId(sample)).toBe(await requestId(JSON.parse(canonical(sample))));
    expect(await requestId({...sample,body:'수정'})).not.toBe(await requestId(sample));
    const key=await requestId(sample);
    expect(await requestId({...sample,request_id:key,id:'central-id',updated_at:'2026-10-29'})).toBe(key);
  });
  it('previews duplicates, title conflicts, invalid records without writing',async()=>{
    const rows=await preview([sample,sample,{...sample,body:'다른 본문'},null],[sample]);
    expect(rows.map(r=>r.status)).toEqual(['duplicate','duplicate','conflict','invalid']);
    expect(rows.every(r=>!r.selected)).toBe(true);
    expect(payloadRows({format:'prompt-collection-local-backup',indexeddb:[sample],localstorage:[]})).toEqual([sample]);
  });
  it('verifies uploaded records and retries only failed selections',async()=>{
    const rows=await preview([sample,{...sample,title:'두 번째'}]);
    let calls=0;let fail=true;const saved=new Map();
    const api={async create(p){calls++;if(p.title==='두 번째'&&fail)throw new Error('network');saved.set(p.request_id,p);return{id:p.request_id};},async get(id){return saved.get(id);}};
    await upload(rows,api);expect(rows.map(r=>r.status)).toEqual(['done','failed']);expect(calls).toBe(2);
    fail=false;await upload(rows,api);expect(rows.map(r=>r.status)).toEqual(['done','done']);expect(calls).toBe(3);
    expect(rows[0].raw).toEqual(sample);
  });
  it('never auto-restores a deleted migration and fails verification mismatches',async()=>{
    const rows=await preview([sample]);
    await upload(rows,{async create(){throw Object.assign(new Error('deleted'),{status:410});}});
    expect(rows[0].status).toBe('deleted');
    const mismatch=await preview([sample]);
    await upload(mismatch,{async create(){return{id:'x'};},async get(){return {...normalize(sample),content:'changed'};}});
    expect(mismatch[0].status).toBe('failed');
  });
});

describe('migration interruption',()=>{
 it('stops between records and retains unattempted selections for retry',async()=>{
  const rows=await preview([sample,{...sample,id:'second',title:'Second'}]);let stop=false;let calls=0;let current;
  const api={async create(p){calls++;current=p;return{id:'saved'};},async get(){return current;}};
  await upload(rows,api,item=>{if(item.status==='done')stop=true;},()=>stop);
  expect(calls).toBe(1);expect(rows.map(r=>r.status)).toEqual(['done','ready']);expect(rows[1].selected).toBe(true);
 });
});
