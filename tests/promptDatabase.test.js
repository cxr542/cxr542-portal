import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

let db;
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const key='33333333-3333-4333-8333-333333333333';
async function asUser(user, query, params=[]) {
  await db.exec(`SET ROLE authenticated; SET request.jwt.claims = '{"sub":"${user}","is_anonymous":false}';`);
  try { return await db.query(query,params); } finally { await db.exec('RESET ROLE;'); }
}
async function write(user,operation,id,version,request,data) {
  return (await asUser(user,'SELECT public.portal_prompt_write($1,$2,$3,$4,$5) AS p',[operation,id,version,request,JSON.stringify(data)])).rows[0].p;
}
beforeAll(async () => {
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${alice}'),('${bob}'); CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb $$; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated,anon;`);
  const path=readdirSync('supabase/migrations').find(p=>p.endsWith('_portal_prompts.sql'));
  await db.exec(readFileSync('supabase/migrations/'+path,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
describe('real PostgreSQL prompt security and transactions',()=>{
  let prompt;
  it('creates once and preserves idempotency, rejecting a changed retry',async()=>{
    prompt=await write(alice,'create',null,null,key,{title:'OOTD',content:'본문',tags:['Art Toy']});
    expect(prompt.owner_id).toBe(alice);
    expect((await write(alice,'create',null,null,key,{title:'OOTD',content:'본문',tags:['Art Toy']})).id).toBe(prompt.id);
    await expect(write(alice,'create',null,null,key,{title:'changed',content:'본문'})).rejects.toMatchObject({code:'PT409'});
  });
  it('RLS hides other owners and direct writes are denied',async()=>{
    expect((await asUser(bob,'SELECT * FROM public.portal_prompts')).rows).toHaveLength(0);
    expect((await asUser(alice,'SELECT * FROM public.portal_prompts')).rows).toHaveLength(1);
    await expect(asUser(bob,'UPDATE public.portal_prompts SET owner_id=$1',[bob])).rejects.toMatchObject({code:'42501'});
    await expect(write(bob,'update',prompt.id,1,null,{content:'attack'})).rejects.toMatchObject({code:'PT404'});
    await expect(write(alice,'update',prompt.id,1,null,{owner_id:bob})).rejects.toMatchObject({code:'PT400'});
  });
  it('anon cannot execute writes or read the table',async()=>{
    await db.exec('SET ROLE anon');
    try { await expect(db.query('SELECT * FROM public.portal_prompts')).rejects.toMatchObject({code:'42501'}); await expect(db.query("SELECT public.portal_prompt_write('create',null,null,null,'{}')")).rejects.toMatchObject({code:'42501'}); }
    finally {await db.exec('RESET ROLE');}
  });
  it('allows exactly one update for the same revision',async()=>{
    const saved=await write(alice,'update',prompt.id,1,null,{content:'기기 A'});
    expect(saved.version).toBe(2);
    await expect(write(alice,'update',prompt.id,1,null,{content:'기기 B'})).rejects.toMatchObject({code:'PT409'});
  });
  it('searches Korean and tags without exposing full content in lists',async()=>{
    const {rows}=await asUser(alice,"SELECT * FROM public.portal_prompt_list('기기',NULL,ARRAY['Art Toy'],NULL,NULL,NULL,21)");
    expect(rows).toHaveLength(1); expect(rows[0]).not.toHaveProperty('content');
  });
  it('keeps tombstones and prevents migration replay from resurrecting data',async()=>{
    await write(alice,'delete',prompt.id,2,null,{});
    await expect(write(alice,'create',null,null,key,{title:'OOTD',content:'본문',tags:['Art Toy']})).rejects.toMatchObject({code:'PT410'});
    await expect(write(alice,'update',prompt.id,3,null,{content:'revive'})).rejects.toMatchObject({code:'PT404'});
    expect((await asUser(alice,"SELECT * FROM public.portal_prompt_list('',NULL,'{}',NULL,NULL,NULL,21)")).rows).toHaveLength(0);
    expect((await db.query('SELECT count(*)::integer AS n FROM portal_private.prompt_audit')).rows[0].n).toBe(3);
  });
  it('persists request limits across calls and denies anonymous JWTs',async()=>{
    await db.exec(`DELETE FROM portal_private.prompt_limits; SET ROLE authenticated; SET request.jwt.claims='{"sub":"${bob}","is_anonymous":true}';`);
    try {await expect(db.query("SELECT public.portal_prompt_list('',NULL,'{}',NULL,NULL,NULL,21)")).rejects.toMatchObject({code:'PT401'});}finally{await db.exec('RESET ROLE');}
    for(let i=0;i<60;i++) await write(bob,'create',null,null,key,{title:'limit',content:''});
    await expect(write(bob,'create',null,null,key,{title:'limit',content:''})).rejects.toMatchObject({code:'PT429'});
  });
  it('counts failed mutations when the API quota commits before the write transaction',async()=>{
    await db.exec('DELETE FROM portal_private.prompt_limits');
    for(let i=0;i<60;i++){
      await asUser(bob,'SELECT public.portal_prompt_limit(true)');
      await expect(write(bob,'update',key,1,null,{content:'no such prompt'})).rejects.toMatchObject({code:'PT404'});
    }
    await expect(asUser(bob,'SELECT public.portal_prompt_limit(true)')).rejects.toMatchObject({code:'PT429'});
  });
});
