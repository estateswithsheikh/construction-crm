-- Construction CRM database setup. Paste into Supabase → SQL Editor → Run. Safe to run again.

-- 1. People who can sign in, with their CRM role.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default '',
  role text not null default 'PENDING' check (role in ('OWNER', 'ADMIN', 'REP', 'CREW_LEAD', 'CREW', 'PENDING')),
  member_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. All CRM records: one row per record, JSON body, grouped by collection
--    (leads, quotes, invoices, projects, expenses, team, overhead, payouts, config).
create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
alter table public.docs replica identity full; -- deletes carry the full row to realtime listeners

-- 3. Role helpers (security definer so policies can read profiles without recursion).
create or replace function public.crm_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_staff() returns boolean
language sql stable as $$ select coalesce(public.crm_role() in ('OWNER', 'ADMIN', 'REP', 'CREW_LEAD', 'CREW'), false) $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.crm_role() in ('OWNER', 'ADMIN'), false) $$;
create or replace function public.can_write(p_collection text) returns boolean
language sql stable as $$
  select case when p_collection in ('config', 'team', 'overhead', 'payouts') then public.is_admin() else public.is_staff() end
$$;

-- 4. Row-level security: only active staff see records; settings, team, overhead and payroll payments need owner/admin.
alter table public.docs enable row level security;
drop policy if exists docs_read on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read on public.docs for select to authenticated using (public.is_staff());
create policy docs_insert on public.docs for insert to authenticated with check (public.can_write(collection));
create policy docs_update on public.docs for update to authenticated using (public.can_write(collection)) with check (public.can_write(collection));
create policy docs_delete on public.docs for delete to authenticated using (public.can_write(collection));

alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

revoke all on public.docs, public.profiles from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select, update on public.profiles to authenticated;

-- 5. New sign-ups: the very first account becomes OWNER, everyone else waits as PENDING until given a role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(4815162342);
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''),
          case when exists (select 1 from public.profiles where role = 'OWNER') then 'PENDING' else 'OWNER' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 6. Guard roles: only owners/admins change roles or access; only owners create owners; always keep one active owner.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only an owner or admin can change roles or access';
    end if;
    if auth.uid() is not null and (new.role = 'OWNER' or old.role = 'OWNER') and public.crm_role() <> 'OWNER' then
      raise exception 'Only an owner can change an owner';
    end if;
    if old.role = 'OWNER' and (new.role <> 'OWNER' or not new.active)
       and not exists (select 1 from public.profiles where role = 'OWNER' and active and id <> old.id) then
      raise exception 'Keep at least one active owner';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- 7. Keep updated_at fresh, and merge partial updates server-side (top-level fields).
create or replace function public.touch_doc() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_doc on public.docs;
create trigger touch_doc before update on public.docs for each row execute function public.touch_doc();

create or replace function public.doc_merge(p_collection text, p_id text, p_patch jsonb) returns void
language sql security invoker set search_path = public as $$
  update public.docs set data = data || p_patch where collection = p_collection and id = p_id
$$;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;

-- 8. Live updates: everyone sees changes as teammates make them.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
