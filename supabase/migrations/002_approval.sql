-- Approval gate. Run after 001_init.sql. Safe to run again.
-- New accounts stay pending. This file does not edit 001.
-- shuadeitsch@gmail.com is marked approved admin because that auth user already exists.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'member_status'
      and e.enumlabel = 'pending'
  ) then
    alter type public.member_status rename to member_status_old;
    create type public.member_status as enum ('invited', 'pending', 'approved', 'rejected', 'disabled');
    alter table public.profiles alter column status drop default;
    alter table public.profiles
      alter column status type public.member_status
      using (
        case status::text
          when 'registered' then 'approved'
          else status::text
        end
      )::public.member_status;
    drop type public.member_status_old;
  end if;
end $$;

alter table public.profiles alter column status set default 'pending';

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
  )
$$;

create or replace function public.access_open()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
  )
$$;

create or replace function public.can_edit_database()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_edit)
  )
$$;

create or replace function public.can_view_contact()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_view_contact)
  )
$$;

create or replace function public.can_view_history()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role = 'admin' or can_view_history)
  )
$$;

create or replace function public.can_log_visit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
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
      and p.status = 'approved'
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
      and p.status = 'approved'
      and (p.role in ('admin', 'visitor') or exists (
        select 1 from public.route_assignments ra where ra.route_id = r.id and ra.user_id = p.id
      ))
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
  if tg_op = 'UPDATE' then
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
      new.id, oid, pname, lower(new.email), 'visitor', 'pending', null, false, false, false
    )
    on conflict (id) do update set
      email = excluded.email;
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
      'visitor',
      'pending',
      inv.expires_at,
      false,
      false,
      false
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
  if lower(old.email) = 'shuadeitsch@gmail.com' then
    new.role := 'admin';
    new.status := 'approved';
    new.expires_at := null;
    new.can_view_history := true;
    new.can_view_contact := true;
    new.can_edit := true;
    new.email := old.email;
    new.org_id := old.org_id;
    return new;
  end if;
  if auth.uid() is not null and public.is_admin() and auth.uid() is distinct from new.id then
    return new;
  end if;
  new.role := old.role;
  new.org_id := old.org_id;
  new.email := old.email;
  new.status := old.status;
  new.expires_at := old.expires_at;
  new.can_view_history := old.can_view_history;
  new.can_view_contact := old.can_view_contact;
  new.can_edit := old.can_edit;
  return new;
end;
$$;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (id = public.my_org_id() and public.is_approved());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (org_id = public.my_org_id() and public.is_approved()));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (org_id = public.my_org_id() and public.is_approved());

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (org_id = public.my_org_id() and public.is_approved());

drop policy if exists fields_select on public.custom_field_defs;
create policy fields_select on public.custom_field_defs for select to authenticated
  using (org_id = public.my_org_id() and public.is_approved());

drop policy if exists notes_select on public.notifications;
create policy notes_select on public.notifications for select to authenticated
  using (org_id = public.my_org_id() and public.is_approved());

grant execute on function public.is_approved() to authenticated;

insert into public.admin_emails (email) values
  ('shuadeitsch+cora@mail.grokbot.com')
on conflict (email) do nothing;

select public.ensure_org();

insert into public.profiles (
  id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit
)
select
  u.id,
  'c0a00000-0000-4000-8000-000000000001',
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    'Shua Deitsch'
  ),
  lower(u.email),
  'admin',
  'approved',
  null,
  true,
  true,
  true
from auth.users u
where lower(u.email) = 'shuadeitsch@gmail.com'
on conflict (id) do update set
  role = 'admin',
  status = 'approved',
  expires_at = null,
  can_view_history = true,
  can_view_contact = true,
  can_edit = true,
  email = excluded.email;
