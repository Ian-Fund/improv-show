-- ============================================================
--  Ticket click counter
--  Paste this whole file into the Supabase SQL Editor and Run.
--  It is safe to run more than once. It does not change the
--  shows table or the troupe list.
--
--  What it does:
--    - Visitors can ADD a click for a published show that has a
--      ticket link. They cannot read, change or delete clicks.
--    - Troupe members can READ the counts on the admin page.
--    - Deleting a show deletes its clicks too.
-- ============================================================

create table if not exists public.ticket_clicks (
  id         uuid primary key default gen_random_uuid(),
  show_id    uuid not null references public.shows(id) on delete cascade,
  -- where the button was: the yellow bar, the featured show, or the list
  place      text not null check (place in ('strip', 'next', 'list')),
  clicked_at timestamptz not null default now()
);

create index if not exists ticket_clicks_show_idx on public.ticket_clicks (show_id);

alter table public.ticket_clicks enable row level security;

-- Supabase gives the website roles full table rights by default.
-- Take them away, then give back only what each role needs.
revoke all on public.ticket_clicks from anon, authenticated;
grant insert (show_id, place) on public.ticket_clicks to anon, authenticated;
grant select on public.ticket_clicks to authenticated;

drop policy if exists "anyone adds a click on a live show" on public.ticket_clicks;
create policy "anyone adds a click on a live show"
  on public.ticket_clicks for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.shows s
      where s.id = show_id
        and s.is_published
        and s.ticket_url is not null
    )
  );

drop policy if exists "members read clicks" on public.ticket_clicks;
create policy "members read clicks"
  on public.ticket_clicks for select to authenticated
  using (private.is_troupe_member());

-- Counts per show for the admin page. SECURITY INVOKER means the
-- policies above still apply: a person who is not a troupe member
-- gets no rows.
create or replace function public.ticket_click_counts()
returns table (
  show_id     uuid,
  total       bigint,
  last_7_days bigint,
  from_strip  bigint,
  from_next   bigint,
  from_list   bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.show_id,
    count(*),
    count(*) filter (where c.clicked_at > now() - interval '7 days'),
    count(*) filter (where c.place = 'strip'),
    count(*) filter (where c.place = 'next'),
    count(*) filter (where c.place = 'list')
  from public.ticket_clicks c
  group by c.show_id;
$$;

revoke all on function public.ticket_click_counts() from public, anon;
grant execute on function public.ticket_click_counts() to authenticated;
