-- ============================================================
--  Improv troupe site — database schema
--  Paste this whole file into the Supabase SQL Editor and Run.
--  It is safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Who is allowed to add shows
-- ------------------------------------------------------------
create table if not exists public.troupe_members (
  email      text primary key,
  name       text,
  added_at   timestamptz not null default now()
);

comment on table public.troupe_members is
  'Allowlist. Anyone can request a magic link, but only addresses in here can touch shows.';

-- ------------------------------------------------------------
-- 2. The shows
-- ------------------------------------------------------------
create table if not exists public.shows (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  venue        text,
  address      text,
  city         text,
  price        text,
  ticket_url   text,
  description  text,
  lineup       text,
  parking      text,
  is_published boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists shows_starts_at_idx on public.shows (starts_at);

-- Added later: parking notes per show. Safe to run against an existing table.
alter table public.shows add column if not exists parking text;

-- A ticket link ends up in an href on the public page. Rejecting anything
-- that is not plain http(s) at the database level means a javascript: or
-- data: URL cannot be stored in the first place, whatever writes it.
alter table public.shows drop constraint if exists shows_ticket_url_scheme;
alter table public.shows add constraint shows_ticket_url_scheme
  check (ticket_url is null or ticket_url ~* '^https?://[^[:space:]]+$');

-- Visitors have no business seeing which member created a row.
revoke select (created_by) on public.shows from anon;

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shows_touch_updated_at on public.shows;
create trigger shows_touch_updated_at
  before update on public.shows
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 3. Membership helper
--
--    SECURITY DEFINER so it can read the allowlist without
--    tripping over the allowlist's own row level security, with
--    search_path pinned so it cannot be tricked into resolving
--    those table names somewhere else.
--
--    It lives in a `private` schema rather than `public` on
--    purpose: schemas outside the API's exposed list are not
--    reachable over PostgREST, so nobody can call this as an RPC
--    endpoint. Policies can still use it.
-- ------------------------------------------------------------
create schema if not exists private;

-- Policies have to let go of the old function before it can be dropped.
drop policy if exists "public reads published shows" on public.shows;
drop policy if exists "members insert shows"        on public.shows;
drop policy if exists "members update shows"        on public.shows;
drop policy if exists "members delete shows"        on public.shows;
drop policy if exists "read own membership"         on public.troupe_members;
drop function if exists public.is_troupe_member();   -- the old location, if you ran the earlier schema

create or replace function private.is_troupe_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.troupe_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function private.is_troupe_member() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_troupe_member() to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Row level security
-- ------------------------------------------------------------
alter table public.shows            enable row level security;
alter table public.troupe_members   enable row level security;

-- Shows: the world can read published dates; members can read everything.
drop policy if exists "public reads published shows" on public.shows;
create policy "public reads published shows"
  on public.shows for select
  using (is_published or private.is_troupe_member());

-- Shows: only members write.
drop policy if exists "members insert shows" on public.shows;
create policy "members insert shows"
  on public.shows for insert to authenticated
  with check (private.is_troupe_member());

drop policy if exists "members update shows" on public.shows;
create policy "members update shows"
  on public.shows for update to authenticated
  using (private.is_troupe_member())
  with check (private.is_troupe_member());

drop policy if exists "members delete shows" on public.shows;
create policy "members delete shows"
  on public.shows for delete to authenticated
  using (private.is_troupe_member());

-- Allowlist: a signed-in person can see their own row; members see the roster.
drop policy if exists "read own membership" on public.troupe_members;
create policy "read own membership"
  on public.troupe_members for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or private.is_troupe_member()
  );

-- Nobody edits the allowlist from the website. Add and remove people
-- in the Supabase table editor, or with the insert below.

-- ------------------------------------------------------------
-- 5. Add your troupe members
--    Edit these lines, then run them. Emails must match exactly
--    what people type when they sign in (case does not matter).
-- ------------------------------------------------------------
insert into public.troupe_members (email, name) values
  ('you@example.com',        'Your Name'),
  ('member2@example.com',    'Member Two'),
  ('member3@example.com',    'Member Three')
on conflict (email) do nothing;
