-- Apply once to the home project. No existing application tables are modified.
create table public.portal_documents (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  namespace text not null,
  key text not null,
  value jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, namespace, key),
  constraint portal_namespace_length check (length(namespace) between 1 and 100),
  constraint portal_key_length check (length(key) between 1 and 300)
);
alter table public.portal_documents enable row level security;
revoke all on public.portal_documents from anon;
grant select, insert, update, delete on public.portal_documents to authenticated;
create policy portal_owner on public.portal_documents for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Optimistic concurrency: stale tabs cannot silently overwrite newer writes.
-- JSON null is a tombstone, so deleted keys retain their revision.
create function public.portal_write(p_namespace text, p_key text, p_value jsonb, p_revision bigint)
returns setof public.portal_documents
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_revision = 0 then
    return query insert into public.portal_documents (user_id, namespace, key, value)
    values (auth.uid(), p_namespace, p_key, p_value)
    on conflict do nothing returning *;
  else
    return query update public.portal_documents
    set value = p_value, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and namespace = p_namespace and key = p_key
      and revision = p_revision returning *;
  end if;
  if not found then raise exception 'portal_write_conflict'; end if;
end;
$$;
revoke all on function public.portal_write(text, text, jsonb, bigint) from public, anon;
grant execute on function public.portal_write(text, text, jsonb, bigint) to authenticated;
