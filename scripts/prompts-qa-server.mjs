import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { createPromptsHandler } from '../server/prompts/handler.mjs';
import { createAuthHandler } from '../server/prompts/auth.mjs';

export async function startPromptFixture(port=4188) {
  if (process.env.PROMPTS_QA !== 'local') throw new Error('Set PROMPTS_QA=local for an ephemeral, loopback-only fixture.');
  const db=new PGlite();
  const users=[{id:'11111111-1111-4111-8111-111111111111',email:'alice@example.invalid',email_confirmed_at:'2026-01-01'},{id:'22222222-2222-4222-8222-222222222222',email:'bob@example.invalid',email_confirmed_at:'2026-01-01'}];
  const sessions=new Map();
  let offline = false;
  let delay = 0;
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${users[0].id}'),('${users[1].id}'); CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb $$; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
  await db.exec(readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(p=>p.endsWith('_portal_prompts.sql')),'utf8'));
  let queue=Promise.resolve();
  const fetcher=async(url,options)=>{
    if (offline) throw new Error('fixture offline');
    if (delay) await new Promise(resolve => setTimeout(resolve,delay));
    const path=new URL(url).pathname; const data=options.body?JSON.parse(options.body):{};
    if(path==='/auth/v1/token'){
      const user=users.find(u=>u.email===data.email)||sessions.get(data.refresh_token);
      if(!user || (data.email && data.password!=='qa-password'))return Response.json({error:'invalid_credentials'},{status:400});
      const access_token='fixture-access-token-'+user.id; const refresh_token='fixture-refresh-token-'+user.id;
      sessions.set(access_token,user);sessions.set(refresh_token,user);return Response.json({access_token,refresh_token,expires_in:3600,user});
    }
    const user=sessions.get(options.headers.authorization?.slice(7));
    if(path==='/auth/v1/user')return Response.json(user||{},{status:user?200:401});
    if(path==='/auth/v1/logout'){for(const [k,v] of sessions)if(v.id===user?.id)sessions.delete(k);return Response.json({ok:true});}
    if(!user)return Response.json({},{status:401});
    const run=async()=>{
      await db.exec(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:user.id,is_anonymous:false})}';`);
      try {
        if(path==='/rest/v1/rpc/portal_prompt_list'){
          const keys=['p_query','p_category','p_tags','p_favorite','p_cursor_time','p_cursor_id','p_limit'];
          return Response.json((await db.query('SELECT * FROM public.portal_prompt_list($1,$2,$3,$4,$5,$6,$7)',keys.map(k=>data[k]))).rows);
        }
        if(path==='/rest/v1/rpc/portal_prompt_get')return Response.json((await db.query('SELECT public.portal_prompt_get($1) AS p',[data.p_id])).rows[0].p);
        if(path==='/rest/v1/rpc/portal_prompt_limit'){await db.query('SELECT public.portal_prompt_limit($1)',[data.p_write]);return Response.json(null);}
        if(path==='/rest/v1/rpc/portal_prompt_export')return Response.json((await db.query('SELECT public.portal_prompt_export($1,$2,$3,$4,$5,$6,$7,$8) AS p',[data.p_query,data.p_category,data.p_tags,data.p_favorite,data.p_cursor_time,data.p_cursor_id,data.p_limit,data.p_include_deleted])).rows.map(r=>r.p));
        if(path==='/rest/v1/rpc/portal_prompt_write'){
          const keys=['p_operation','p_id','p_version','p_request_id','p_data'];
          return Response.json((await db.query('SELECT public.portal_prompt_write($1,$2,$3,$4,$5) AS p',keys.map(k=>k==='p_data'?JSON.stringify(data[k]):data[k]))).rows[0].p);
        }
        return Response.json({},{status:404});
      }catch(e){return Response.json({code:e.code},{status:400});}finally{await db.exec('RESET ROLE');}
    };
    const pending=queue.then(run);queue=pending.catch(()=>{});return pending;
  };
  const deps={env:{PROMPTS_ENABLED:'true',PROMPTS_SUPABASE_URL:'https://fixture.supabase.co',PROMPTS_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},fetcher,logger:{info(){}}};
  const prompts=createPromptsHandler(deps); const auth=createAuthHandler(deps);
  const root=resolve('.cache/prompt-actions-assets/public');
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path.startsWith('/api/prompts'))return prompts(req,res);
    if(path.startsWith('/api/prompt-auth/'))return auth(req,res);
    if(path.startsWith('/api/')){res.writeHead(404,{'content-type':'application/json'});res.end('{}');return;}
    let file=resolve(root,'.'+decodeURIComponent(path));
    if(!file.startsWith(root+'/')&&file!==root){res.writeHead(403);res.end();return;}
    if(file===root||!extname(file))file=resolve(root,'index.html');
    if(!existsSync(file)){res.writeHead(404);res.end();return;}
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
    const bytes=readFileSync(file);
    const compress=/\bgzip\b/.test(req.headers['accept-encoding']||'') && ['.html','.js','.css','.json','.svg'].includes(extname(file));
    res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream',...(compress?{'content-encoding':'gzip',vary:'Accept-Encoding'}:{})});res.end(compress?gzipSync(bytes):bytes);
  });
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  return {url:'http://127.0.0.1:'+server.address().port,db,setOffline(value){offline=value;},setDelay(value){delay=value;},async close(){await new Promise(r=>server.close(r));await db.close();}};
}
