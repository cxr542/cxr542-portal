-- Review/apply separately before releasing the client. Never clears ratings.
create function public.portal_merge_ratings(
  p_snapshot jsonb, p_changes jsonb, p_backup_key text, p_overwrite boolean default false
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_snapshot jsonb;
  backup jsonb;
  item jsonb;
  previous public.portal_documents;
  identity_source text;
  identity_external text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_snapshot) is distinct from 'array'
    or jsonb_typeof(p_changes) is distinct from 'array'
    or p_overwrite is null then raise exception 'invalid_import'; end if;

  -- Includes ordinary portal_write and direct DML, without replacing that API.
  -- Serializes portal writes briefly; readers remain unblocked. RLS still applies.
  set local lock_timeout = '5s';
  lock table public.portal_documents in share row exclusive mode;
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'revision', revision, 'value', value)
    order by key collate "C"), '[]'::jsonb) into current_snapshot
  from public.portal_documents where user_id = auth.uid() and namespace = 'how-many-points';
  if current_snapshot <> p_snapshot then raise exception 'ratings_import_stale_preview'; end if;
  select value into backup from public.portal_documents
    where user_id = auth.uid() and namespace = 'how-many-points-backups' and key = p_backup_key;
  if backup is null or backup->'records' is distinct from current_snapshot
    or backup->'ratings' is distinct from (
      select coalesce(jsonb_agg(value order by key collate "C"), '[]'::jsonb)
      from public.portal_documents where user_id = auth.uid() and namespace = 'how-many-points' and value is not null and value <> 'null'::jsonb
    ) then raise exception 'ratings_import_backup_required'; end if;

  for item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string'
      or length(item->>'id') not between 1 and 300 or jsonb_typeof(item->'title') is distinct from 'string'
      or btrim(item->>'title') = '' then raise exception 'invalid_import_item'; end if;
    identity_source := lower(btrim(coalesce(nullif(item->>'source', ''), 'watcha')));
    identity_external := btrim(coalesce(item->>'externalId', item->>'watchaId', ''));
    select * into previous from public.portal_documents
      where user_id = auth.uid() and namespace = 'how-many-points' and key = item->>'id';
    if found then
      if previous.value is null or previous.value = 'null'::jsonb or not p_overwrite
        or lower(btrim(coalesce(nullif(previous.value->>'source', ''), 'watcha'))) <> identity_source
        or btrim(coalesce(previous.value->>'externalId', previous.value->>'watchaId', '')) <> identity_external
        then raise exception 'ratings_import_existing_item_protected'; end if;
    end if;
    if identity_external <> '' and exists (
      select 1 from public.portal_documents
      where user_id = auth.uid() and namespace = 'how-many-points' and key <> item->>'id' and value is not null and value <> 'null'::jsonb
        and lower(btrim(coalesce(nullif(value->>'source', ''), 'watcha'))) = identity_source
        and btrim(coalesce(value->>'externalId', value->>'watchaId', '')) = identity_external
    ) then raise exception 'ratings_import_duplicate_identity'; end if;
    insert into public.portal_documents(user_id, namespace, key, value)
      values(auth.uid(), 'how-many-points', item->>'id', item)
      on conflict (user_id, namespace, key) do update
        set value = excluded.value, revision = portal_documents.revision + 1, updated_at = now();
  end loop;
  return jsonb_build_object('applied', jsonb_array_length(p_changes), 'total', (
    select count(*) from public.portal_documents
    where user_id = auth.uid() and namespace = 'how-many-points' and value is not null and value <> 'null'::jsonb
  ));
end;
$$;
revoke all on function public.portal_merge_ratings(jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.portal_merge_ratings(jsonb, jsonb, text, boolean) to authenticated;
