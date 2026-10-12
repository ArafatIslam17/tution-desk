-- Tuition Desk database schema for Supabase (PostgreSQL).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again: every statement is idempotent.

-- Every piece of app data is a JSON document owned by one user:
--   kind = 'app'      id = 'app'      profile & preferences
--   kind = 'students' id = <id>       one row per student (fee and schedule history included)
--   kind = 'uni'      id = <id>       one row per university class
--   kind = 'months'   id = 'YYYY-MM'  that month's classes, teaching-time records, payments and fee overrides
create table if not exists public.documents (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('app', 'students', 'uni', 'months')),
  id         text        not null check (id ~ '^[A-Za-z0-9_.~:@+-]{1,150}$'),
  data       jsonb       not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id),
  constraint documents_size check (pg_column_size(data) < 1000000)
);

comment on table public.documents is 'Tuition Desk: per-user JSON documents. Access is restricted to the owner by row-level security.';

-- Keep updated_at current.
create or replace function public.documents_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.documents_touch();

-- Row-level security: a signed-in user can only see and change their own rows.
alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;

create policy "documents_select_own" on public.documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "documents_insert_own" on public.documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "documents_update_own" on public.documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "documents_delete_own" on public.documents for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-out visitors get no access at all.
revoke all on public.documents from anon;
grant select, insert, update, delete on public.documents to authenticated;

-- Live sync between your phone and laptop.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;
