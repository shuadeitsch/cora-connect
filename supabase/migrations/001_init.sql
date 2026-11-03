-- Cora: household outreach CRM
-- Run this in the Supabase SQL editor (or as the first migration).
-- Sample rows are loaded separately and are fictional.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin', 'visitor', 'limited');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_status as enum ('invited', 'registered');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.visit_status as enum ('completed', 'deferred');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.reaction as enum ('happy', 'warm', 'neutral', 'cold', 'not_interested');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.gender as enum ('him', 'her');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.category_kind as enum ('regular', 'scheduled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.custom_field_type as enum ('text', 'number', 'date', 'select');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chabad_house_name text not null default '',
  street text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  country text not null default 'USA',
  lat double precision,
  lng double precision,
  start_lat double precision,
  start_lng double precision,
  default_state text not null default '',
  plan_name text not null default 'Up to 1,000 — Year-Round',
  plan_limit integer not null default 1000,
  plan_renews_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'visitor',
  status public.member_status not null default 'registered',
  expires_at date,
  can_view_history boolean not null default true,
  can_view_contact boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  interval_days integer,
  created_at timestamptz not null default now(),
  check (interval_days is null or interval_days > 0)
);

create table if not exists public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  field_type public.custom_field_type not null default 'text',
  options text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  street text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  country text not null default 'USA',
  lat double precision,
  lng double precision,
  notes text not null default '',
  project_id uuid references public.projects (id) on delete set null,
  schedule_category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  gender public.gender,
  phone text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.household_categories (
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (household_id, category_id)
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  visitor_id uuid references public.profiles (id) on delete set null,
  visitor_name text not null default '',
  visit_date date not null,
  status public.visit_status not null,
  reaction public.reaction,
  details text not null default '',
  follow_up_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  project_id uuid references public.projects (id) on delete set null,
  optimized boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  position integer not null,
  unique (route_id, household_id)
);

create table if not exists public.route_assignments (
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (route_id, user_id)
);

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default '',
  email text not null,
  role public.user_role not null default 'visitor',
  expires_at date,
  can_view_history boolean not null default true,
  can_view_contact boolean not null default true,
  can_edit boolean not null default false,
  assigned_route_ids uuid[] not null default '{}',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (notification_id, user_id)
);

create index if not exists households_org_idx on public.households (org_id);
create index if not exists people_household_idx on public.people (household_id);
create index if not exists visits_household_idx on public.visits (household_id, visit_date desc);
create index if not exists route_stops_route_idx on public.route_stops (route_id, position);
create index if not exists route_assignments_user_idx on public.route_assignments (user_id);

create or replace function public.my_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and (expires_at is null or expires_at >= current_date)
  )
$$;

create or replace function public.access_open()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (expires_at is null or expires_at >= current_date)
  )
$$;

create or replace function public.can_edit_database()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_edit)
  )
$$;

create or replace function public.can_view_contact()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_view_contact)
  )
$$;

create or replace function public.can_view_history()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_view_history)
  )
$$;

create or replace function public.can_log_visit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (expires_at is null or expires_at >= current_date)
      and (role in ('admin', 'visitor') or can_edit)
  )
$$;

create or replace function public.can_see_household(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.households h
    join public.profiles p on p.id = auth.uid() and p.org_id = h.org_id
    where h.id = hid
      and (
        p.role in ('admin', 'visitor')
        or exists (
          select 1
          from public.route_stops rs
          join public.route_assignments ra on ra.route_id = rs.route_id
          where rs.household_id = h.id and ra.user_id = p.id
        )
      )
  )
$$;

create or replace function public.can_see_route(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.routes r
    join public.profiles p on p.id = auth.uid() and p.org_id = r.org_id
    where r.id = rid
      and (p.role in ('admin', 'visitor') or exists (
        select 1 from public.route_assignments ra where ra.route_id = r.id and ra.user_id = p.id
      ))
  )
$$;

create or replace function public.seed_org_defaults(oid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories (id, org_id, name, kind, interval_days) values
    ('c0a00000-0000-4000-8000-00000000012d', oid, 'None', 'scheduled', null),
    ('c0a00000-0000-4000-8000-00000000012e', oid, 'Monthly', 'scheduled', 30),
    ('c0a00000-0000-4000-8000-00000000012f', oid, 'Bi-Monthly', 'scheduled', 60),
    ('c0a00000-0000-4000-8000-000000000130', oid, 'Quarterly', 'scheduled', 90),
    ('c0a00000-0000-4000-8000-000000000131', oid, 'Twice a year', 'scheduled', 180),
    ('c0a00000-0000-4000-8000-000000000132', oid, 'Yearly', 'scheduled', 365),
    ('c0a00000-0000-4000-8000-000000000137', oid, 'New', 'regular', null),
    ('c0a00000-0000-4000-8000-000000000138', oid, 'Challah', 'regular', null),
    ('c0a00000-0000-4000-8000-000000000139', oid, 'Honey', 'regular', null),
    ('c0a00000-0000-4000-8000-00000000013a', oid, 'Mezuzah', 'regular', null),
    ('c0a00000-0000-4000-8000-00000000013b', oid, 'Student', 'regular', null),
    ('c0a00000-0000-4000-8000-00000000013c', oid, 'Moved away', 'regular', null),
    ('c0a00000-0000-4000-8000-00000000013d', oid, 'Isolated family', 'regular', null)
  on conflict (id) do nothing;
  insert into public.projects (id, org_id, name) values
    ('c0a00000-0000-4000-8000-0000000000c9', oid, 'Summer Circuit 2026'),
    ('c0a00000-0000-4000-8000-0000000000ca', oid, 'High Holiday Honey'),
    ('c0a00000-0000-4000-8000-0000000000cb', oid, 'Unsorted Routes')
  on conflict (id) do nothing;
  insert into public.custom_field_defs (id, org_id, name, field_type, options) values
    ('c0a00000-0000-4000-8000-000000000191', oid, 'Hebrew name', 'text', '{}'),
    ('c0a00000-0000-4000-8000-000000000192', oid, 'Best time to visit', 'select', array['Morning', 'Afternoon', 'Evening', 'Sunday only']),
    ('c0a00000-0000-4000-8000-000000000193', oid, 'Year arrived', 'number', '{}')
  on conflict (id) do nothing;
end;
$$;

create or replace function public.ensure_org()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  oid uuid := 'c0a00000-0000-4000-8000-000000000001';
begin
  insert into public.organizations (id, name, plan_renews_on)
  values (oid, 'Chabad Outreach to Rural America', current_date + 365)
  on conflict (id) do nothing;
  perform public.seed_org_defaults(oid);
  return oid;
end;
$$;

create or replace function public.is_allowlisted_admin(target_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_emails where lower(email) = lower(target_email)
  )
$$;

create or replace function public.login_allowed(target_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_allowlisted_admin(target_email)
    or exists (select 1 from public.profiles where lower(email) = lower(target_email))
    or exists (
      select 1 from public.invites
      where lower(email) = lower(target_email) and accepted_at is null
    )
$$;

create or replace function public.sync_profile_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.invites%rowtype;
  oid uuid;
  pname text;
begin
  if new.email is null then
    return new;
  end if;
  if tg_op = 'INSERT' and coalesce(new.raw_app_meta_data->>'seed', '') = 'true' then
    return new;
  end if;

  pname := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );

  if public.is_allowlisted_admin(new.email) then
    oid := public.ensure_org();
    insert into public.profiles (
      id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit
    ) values (
      new.id, oid, pname, lower(new.email), 'admin', 'registered', null, true, true, true
    )
    on conflict (id) do update set
      role = 'admin',
      status = 'registered',
      expires_at = null,
      can_view_history = true,
      can_view_contact = true,
      can_edit = true,
      name = excluded.name,
      email = excluded.email;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;

  select * into inv from public.invites
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc
  limit 1;

  if inv.id is not null then
    insert into public.profiles (
      id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit
    ) values (
      new.id,
      inv.org_id,
      coalesce(nullif(inv.name, ''), pname),
      lower(new.email),
      inv.role,
      'registered',
      inv.expires_at,
      (inv.role = 'admin' or inv.can_view_history),
      (inv.role = 'admin' or inv.can_view_contact),
      (inv.role = 'admin' or inv.can_edit)
    );
    insert into public.route_assignments (route_id, user_id)
    select r.id, new.id
    from unnest(inv.assigned_route_ids) as rid
    join public.routes r on r.id = rid
    on conflict do nothing;
    update public.invites set accepted_at = now() where id = inv.id;
    return new;
  end if;

  raise exception 'No invitation was found for %', new.email using errcode = 'P0001';
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_allowlisted_admin(new.email) then
    new.role := 'admin';
    new.status := 'registered';
    new.expires_at := null;
    new.can_view_history := true;
    new.can_view_contact := true;
    new.can_edit := true;
    return new;
  end if;
  if auth.uid() is not null and public.is_admin() and auth.uid() is distinct from new.id then
    return new;
  end if;
  new.role := old.role;
  new.org_id := old.org_id;
  new.email := old.email;
  new.expires_at := old.expires_at;
  new.can_view_history := old.can_view_history;
  new.can_view_contact := old.can_view_contact;
  new.can_edit := old.can_edit;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.sync_profile_from_auth();

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

create or replace view public.people_visible
with (security_invoker = false) as
select
  pe.id,
  pe.household_id,
  pe.name,
  pe.gender,
  pe.sort_order,
  case when public.can_view_contact() then pe.phone else '' end as phone,
  case when public.can_view_contact() then pe.email else '' end as email,
  case when public.can_view_contact() then pe.whatsapp else '' end as whatsapp
from public.people pe
where public.can_see_household(pe.household_id);

create or replace view public.visits_visible
with (security_invoker = false) as
select
  v.id,
  v.org_id,
  v.household_id,
  v.visitor_id,
  v.visitor_name,
  v.visit_date,
  v.status,
  case when public.can_view_history() then v.reaction else null end as reaction,
  case when public.can_view_history() then v.details else '' end as details,
  v.follow_up_date,
  v.created_at
from public.visits v
where v.org_id = public.my_org_id()
  and public.can_see_household(v.household_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.categories enable row level security;
alter table public.custom_field_defs enable row level security;
alter table public.households enable row level security;
alter table public.people enable row level security;
alter table public.household_categories enable row level security;
alter table public.visits enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.route_assignments enable row level security;
alter table public.admin_emails enable row level security;
alter table public.invites enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists org_select on public.organizations;
drop policy if exists org_update on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (id = public.my_org_id());
create policy org_update on public.organizations for update to authenticated
  using (id = public.my_org_id() and public.is_admin())
  with check (id = public.my_org_id() and public.is_admin());

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (org_id = public.my_org_id());
create policy profiles_update on public.profiles for update to authenticated
  using (org_id = public.my_org_id() and (public.is_admin() or id = auth.uid()))
  with check (org_id = public.my_org_id() and (public.is_admin() or id = auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated
  using (org_id = public.my_org_id() and public.is_admin() and id <> auth.uid());

drop policy if exists projects_all on public.projects;
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (org_id = public.my_org_id());
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists categories_select on public.categories;
drop policy if exists categories_write on public.categories;
create policy categories_select on public.categories for select to authenticated using (org_id = public.my_org_id());
create policy categories_write on public.categories for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists fields_select on public.custom_field_defs;
drop policy if exists fields_write on public.custom_field_defs;
create policy fields_select on public.custom_field_defs for select to authenticated using (org_id = public.my_org_id());
create policy fields_write on public.custom_field_defs for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists households_select on public.households;
drop policy if exists households_write on public.households;
drop policy if exists households_insert on public.households;
drop policy if exists households_update on public.households;
drop policy if exists households_delete on public.households;
create policy households_select on public.households for select to authenticated
  using (public.can_see_household(id));
create policy households_insert on public.households for insert to authenticated
  with check (org_id = public.my_org_id() and public.can_edit_database());
create policy households_update on public.households for update to authenticated
  using (org_id = public.my_org_id() and public.can_edit_database())
  with check (org_id = public.my_org_id() and public.can_edit_database());
create policy households_delete on public.households for delete to authenticated
  using (org_id = public.my_org_id() and public.can_edit_database());

drop policy if exists people_write on public.people;
create policy people_write on public.people for all to authenticated
  using (public.can_edit_database() and public.can_see_household(household_id))
  with check (public.can_edit_database() and public.can_see_household(household_id));

drop policy if exists hc_select on public.household_categories;
drop policy if exists hc_write on public.household_categories;
create policy hc_select on public.household_categories for select to authenticated
  using (public.can_see_household(household_id));
create policy hc_write on public.household_categories for all to authenticated
  using (public.can_edit_database() and public.can_see_household(household_id))
  with check (public.can_edit_database() and public.can_see_household(household_id));

drop policy if exists visits_select on public.visits;
drop policy if exists visits_insert on public.visits;
drop policy if exists visits_update on public.visits;
drop policy if exists visits_delete on public.visits;
create policy visits_select on public.visits for select to authenticated
  using (org_id = public.my_org_id() and public.can_see_household(household_id));
create policy visits_insert on public.visits for insert to authenticated
  with check (org_id = public.my_org_id() and public.can_log_visit() and public.can_see_household(household_id));
create policy visits_update on public.visits for update to authenticated
  using (org_id = public.my_org_id() and public.can_log_visit() and (public.is_admin() or visitor_id = auth.uid()))
  with check (org_id = public.my_org_id() and public.can_log_visit());
create policy visits_delete on public.visits for delete to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

drop policy if exists routes_select on public.routes;
drop policy if exists routes_write on public.routes;
drop policy if exists routes_insert on public.routes;
drop policy if exists routes_update on public.routes;
drop policy if exists routes_delete on public.routes;
create policy routes_select on public.routes for select to authenticated using (public.can_see_route(id));
create policy routes_insert on public.routes for insert to authenticated
  with check (org_id = public.my_org_id() and public.access_open() and public.my_role() in ('admin', 'visitor'));
create policy routes_update on public.routes for update to authenticated
  using (public.can_see_route(id) and public.access_open() and public.my_role() in ('admin', 'visitor'))
  with check (org_id = public.my_org_id());
create policy routes_delete on public.routes for delete to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

drop policy if exists stops_select on public.route_stops;
drop policy if exists stops_write on public.route_stops;
create policy stops_select on public.route_stops for select to authenticated using (public.can_see_route(route_id));
create policy stops_write on public.route_stops for all to authenticated
  using (public.can_see_route(route_id) and public.access_open() and public.my_role() in ('admin', 'visitor'))
  with check (public.can_see_route(route_id) and public.my_role() in ('admin', 'visitor'));

drop policy if exists assign_select on public.route_assignments;
drop policy if exists assign_write on public.route_assignments;
create policy assign_select on public.route_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy assign_write on public.route_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists notes_select on public.notifications;
create policy notes_select on public.notifications for select to authenticated using (org_id = public.my_org_id());
drop policy if exists notes_write on public.notifications;
create policy notes_write on public.notifications for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

drop policy if exists reads_select on public.notification_reads;
drop policy if exists reads_write on public.notification_reads;
create policy reads_select on public.notification_reads for select to authenticated using (user_id = auth.uid());
create policy reads_write on public.notification_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on table public.people from anon, authenticated;
grant select (id, household_id, name, gender, sort_order), insert, update, delete on table public.people to authenticated;

revoke all on table public.visits from anon, authenticated;
grant select (id, org_id, household_id, visitor_id, visitor_name, visit_date, status, follow_up_date, created_at),
  insert, update, delete on table public.visits to authenticated;

grant select on public.people_visible, public.visits_visible to authenticated;

grant select, update on public.organizations to authenticated;
grant select, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.categories, public.custom_field_defs,
  public.households, public.household_categories, public.routes, public.route_stops, public.route_assignments,
  public.invites, public.notifications, public.notification_reads to authenticated;

grant execute on function public.my_org_id() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.access_open() to authenticated;
grant execute on function public.can_edit_database() to authenticated;
grant execute on function public.can_view_contact() to authenticated;
grant execute on function public.can_view_history() to authenticated;
grant execute on function public.can_log_visit() to authenticated;
grant execute on function public.can_see_household(uuid) to authenticated;
grant execute on function public.can_see_route(uuid) to authenticated;

revoke all on table public.admin_emails from anon, authenticated;
revoke all on function public.ensure_org() from public, anon, authenticated;
revoke all on function public.seed_org_defaults(uuid) from public, anon, authenticated;
revoke all on function public.sync_profile_from_auth() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.sync_profile_from_auth() to supabase_auth_admin;
  end if;
end $$;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
revoke all on function public.is_allowlisted_admin(text) from public, anon, authenticated;
revoke all on function public.login_allowed(text) from public;
grant execute on function public.login_allowed(text) to anon, authenticated;

insert into public.admin_emails (email) values
  ('shuadeitsch@gmail.com'),
  ('mendelgreisman@gmail.com')
on conflict (email) do nothing;

select public.ensure_org();
