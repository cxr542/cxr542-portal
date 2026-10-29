-- The account UUID is added by the administrator after the owner creates a password.
-- This is independent of other applications and Auth accounts in the home project.
create table public.portal_account (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
alter table public.portal_account enable row level security;
revoke all on public.portal_account from public, anon, authenticated;
grant select on public.portal_account to authenticated;
create policy portal_account_self on public.portal_account for select to authenticated
using (user_id = (select auth.uid()));

drop policy portal_owner on public.portal_documents;
create policy portal_owner on public.portal_documents for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.portal_account a where a.user_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.portal_account a where a.user_id = (select auth.uid()))
);
