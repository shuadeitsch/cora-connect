-- Daily planner: days, and the routes and events planned on each day.
-- New tables only. Does not change existing tables, data, or access rules.
-- Read: approved (not expired) members of the same org. Write: approved admins of the org.

create table if not exists public.planner_days (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, date)
);

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  day_id uuid not null references public.planner_days(id) on delete cascade,
  kind text not null check (kind in ('route', 'event')),
  route_id uuid references public.routes(id) on delete set null,
  title text not null default '',
  time time,
  notes text not null default '',
  sort integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_items_day_idx on public.planner_items (day_id, sort);

alter table public.planner_days enable row level security;
alter table public.planner_items enable row level security;

drop policy if exists planner_days_select on public.planner_days;
create policy planner_days_select on public.planner_days
  for select using (org_id = public.my_org_id() and public.access_open());
drop policy if exists planner_days_write on public.planner_days;
create policy planner_days_write on public.planner_days
  for all using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists planner_items_select on public.planner_items;
create policy planner_items_select on public.planner_items
  for select using (org_id = public.my_org_id() and public.access_open());
drop policy if exists planner_items_write on public.planner_items;
create policy planner_items_write on public.planner_items
  for all using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

grant select, insert, update, delete on public.planner_days, public.planner_items to authenticated;

-- Starting days: Dec 5 to Dec 11, 2026.
insert into public.planner_days (org_id, date)
select o.id, d::date
from public.organizations o
cross join generate_series(date '2026-12-05', date '2026-12-11', interval '1 day') as d
on conflict (org_id, date) do nothing;
