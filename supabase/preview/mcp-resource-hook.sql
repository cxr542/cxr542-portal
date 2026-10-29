-- REVIEW CANDIDATE ONLY. Not applied to cloud. Enable the Auth hook separately.
-- Dedicated OAuth clients each bind to one immutable MCP resource.
begin;
create schema if not exists prompt_preview_private;
create table prompt_preview_private.mcp_oauth_resources (
  client_id uuid primary key,
  resource text not null check (resource ~ '^https://[a-z0-9.-]+/api/prompt-mcp$'),
  enabled boolean not null default false
);
alter table prompt_preview_private.mcp_oauth_resources enable row level security;
revoke all on prompt_preview_private.mcp_oauth_resources from public, anon, authenticated;
grant usage on schema prompt_preview_private to supabase_auth_admin;
grant select on prompt_preview_private.mcp_oauth_resources to supabase_auth_admin;
create policy mcp_hook_lookup on prompt_preview_private.mcp_oauth_resources
  for select to supabase_auth_admin using (true);
create function prompt_preview_private.mcp_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare bound_resource text;
begin
  select r.resource into bound_resource
  from prompt_preview_private.mcp_oauth_resources r
  where r.client_id::text = event->'claims'->>'client_id' and r.enabled;
  if bound_resource is not null then
    return jsonb_set(event, '{claims,resource}', to_jsonb(bound_resource));
  end if;
  return event;
end;
$$;
revoke all on function prompt_preview_private.mcp_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function prompt_preview_private.mcp_access_token_hook(jsonb) to supabase_auth_admin;
commit;
