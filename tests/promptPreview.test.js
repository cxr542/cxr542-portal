import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { buildPreviewSql, sourcePath, outputPath } from '../scripts/build-prompts-preview.mjs';

const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const outsider='33333333-3333-4333-8333-333333333333';
let db,prompt;
const source=readFileSync(sourcePath,'utf8');
async function asUser(id,sql,args=[],anonymous=false){
  await db.exec(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:id,is_anonymous:anonymous,user_metadata:{preview:true}})}'`);
  try{return await db.query(sql,args);}finally{await db.exec('RESET ROLE');}
}
async function write(id,operation,item,version,key,data){
  return (await asUser(id,'SELECT prompt_preview.portal_prompt_write($1,$2,$3,$4,$5) AS p',[operation,item,version,key,JSON.stringify(data)])).rows[0].p;
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${outsider}'); CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb $$; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; CREATE TABLE public.existing_home_data(id integer PRIMARY KEY, value text); INSERT INTO public.existing_home_data VALUES(1,'preserved');`);
  await db.exec(source);
  await db.exec(buildPreviewSql(source));
  await db.query('INSERT INTO prompt_preview_private.test_users VALUES ($1),($2)',[alice,bob]);
  prompt=await write(alice,'create',null,null,alice,{title:'Preview test',content:'Private content'});
},30000);
afterAll(async()=>{await db?.close();});

describe('home preview schema isolation',()=>{
  it('keeps the review artifact in sync with core SQL',()=>{
    expect(readFileSync(outputPath,'utf8')).toBe(buildPreviewSql(source));
    expect(()=>buildPreviewSql(source.replace('BEGIN;','-- changed'))).toThrow('review');
  });
  it('does not change existing home tables or the public prompt schema',async()=>{
    expect((await db.query('SELECT * FROM public.existing_home_data')).rows).toEqual([{id:1,value:'preserved'}]);
    expect((await db.query('SELECT * FROM public.portal_prompts')).rows).toHaveLength(0);
    expect((await asUser(alice,'SELECT * FROM prompt_preview.portal_prompts')).rows).toHaveLength(1);
  });
  it('denies nonmembers at RPC and private mutation paths, ignoring user_metadata',async()=>{
    expect((await asUser(outsider,'SELECT * FROM prompt_preview.portal_prompts')).rows).toHaveLength(0);
    await expect(asUser(outsider,'SELECT prompt_preview.portal_prompt_limit(false)')).rejects.toMatchObject({code:'PT403'});
    await expect(asUser(outsider,"SELECT * FROM prompt_preview.portal_prompt_list('',NULL,'{}',NULL,NULL,NULL,21)")).rejects.toMatchObject({code:'PT403'});
    await expect(asUser(outsider,'SELECT prompt_preview.portal_prompt_get($1)',[prompt.id])).rejects.toMatchObject({code:'PT403'});
    await expect(asUser(outsider,"SELECT * FROM prompt_preview.portal_prompt_export('',NULL,'{}',NULL,NULL,NULL,21,true)")).rejects.toMatchObject({code:'PT403'});
    await expect(write(outsider,'create',null,null,outsider,{title:'attack',content:'x'})).rejects.toMatchObject({code:'PT403'});
    await expect(asUser(outsider,"SELECT prompt_preview_private.prompt_write('delete',$1,1,NULL,'{}')",[prompt.id])).rejects.toMatchObject({code:'PT403'});
    await expect(asUser(outsider,'INSERT INTO prompt_preview_private.test_users VALUES($1)',[outsider])).rejects.toMatchObject({code:'42501'});
  });
  it('limits members to their own records and forbids direct writes',async()=>{
    expect((await asUser(bob,'SELECT * FROM prompt_preview.portal_prompts')).rows).toHaveLength(0);
    await expect(write(bob,'update',prompt.id,1,null,{content:'attack'})).rejects.toMatchObject({code:'PT404'});
    await expect(asUser(alice,'UPDATE prompt_preview.portal_prompts SET owner_id=$1',[bob])).rejects.toMatchObject({code:'42501'});
  });
  it('immediately removes both direct and RPC access when membership is revoked',async()=>{
    await db.query('DELETE FROM prompt_preview_private.test_users WHERE owner_id=$1',[alice]);
    try{
      expect((await asUser(alice,'SELECT * FROM prompt_preview.portal_prompts')).rows).toHaveLength(0);
      await expect(asUser(alice,'SELECT prompt_preview.portal_prompt_get($1)',[prompt.id])).rejects.toMatchObject({code:'PT403'});
    }finally{await db.query('INSERT INTO prompt_preview_private.test_users VALUES($1)',[alice]);}
  });
  it('preserves idempotency, optimistic locking and tombstones in preview',async()=>{
    const data={title:'Preview test',content:'Private content'};
    expect((await write(alice,'create',null,null,alice,data)).id).toBe(prompt.id);
    await expect(write(alice,'create',null,null,alice,{...data,content:'changed'})).rejects.toMatchObject({code:'PT409'});
    expect((await write(alice,'update',prompt.id,1,null,{content:'updated'})).version).toBe(2);
    await expect(write(alice,'update',prompt.id,1,null,{content:'stale'})).rejects.toMatchObject({code:'PT409'});
    await write(alice,'delete',prompt.id,2,null,{});
    await expect(write(alice,'create',null,null,alice,data)).rejects.toMatchObject({code:'PT410'});
  });
  it('denies anonymous JWTs and anon role, and refuses existing schema replacement',async()=>{
    await expect(asUser(alice,'SELECT prompt_preview.portal_prompt_limit(false)',[],true)).rejects.toMatchObject({code:'PT401'});
    await db.exec('SET ROLE anon');
    try{await expect(db.query('SELECT * FROM prompt_preview.portal_prompts')).rejects.toMatchObject({code:'42501'});}finally{await db.exec('RESET ROLE');}
    await expect(db.exec(buildPreviewSql(source))).rejects.toThrow('already exists');
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT * FROM public.existing_home_data')).rows).toHaveLength(1);
  });
  it('rolls back only preview objects and preserves existing schemas and auth users',async()=>{
    await db.exec(readFileSync('supabase/preview/rollback.sql','utf8'));
    expect((await db.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('prompt_preview','prompt_preview_private')")).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM public.existing_home_data')).rows).toEqual([{id:1,value:'preserved'}]);
    expect((await db.query('SELECT * FROM public.portal_prompts')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM auth.users')).rows).toHaveLength(3);
  });
});
