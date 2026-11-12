-- 1.8.61: Pre-planner — contacts who said they are ready for a visit, with a requested date and time.
create table if not exists public.preplanner_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  requested_date date not null,
  requested_time time not null,
  reached_how text not null,
  notes text not null default '',
  scheduled_at timestamptz,
  scheduled_day_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preplanner_reached_how_check check (
    reached_how in ('email', 'text', 'whatsapp', 'phone', 'in_person', 'other')
  )
);

create index if not exists preplanner_entries_org_date_idx
  on public.preplanner_entries (org_id, requested_date, requested_time);

create index if not exists preplanner_entries_household_idx
  on public.preplanner_entries (household_id);

comment on table public.preplanner_entries is
  'Contacts who asked for a visit. requested_date and requested_time are required. scheduled_at is set when the visit is added to the Daily planner.';

alter table public.preplanner_entries enable row level security;

drop policy if exists preplanner_entries_select on public.preplanner_entries;
create policy preplanner_entries_select on public.preplanner_entries
  for select to authenticated
  using (org_id = public.my_org_id() and public.access_open() and public.can_see_household(household_id));

drop policy if exists preplanner_entries_insert on public.preplanner_entries;
create policy preplanner_entries_insert on public.preplanner_entries
  for insert to authenticated
  with check (org_id = public.my_org_id() and public.access_open() and public.can_see_household(household_id));

drop policy if exists preplanner_entries_update on public.preplanner_entries;
create policy preplanner_entries_update on public.preplanner_entries
  for update to authenticated
  using (org_id = public.my_org_id() and public.access_open() and public.can_see_household(household_id))
  with check (org_id = public.my_org_id() and public.access_open() and public.can_see_household(household_id));

drop policy if exists preplanner_entries_delete on public.preplanner_entries;
create policy preplanner_entries_delete on public.preplanner_entries
  for delete to authenticated
  using (org_id = public.my_org_id() and public.access_open() and public.can_see_household(household_id));

revoke all on table public.preplanner_entries from anon, authenticated;
grant select, insert, update, delete on table public.preplanner_entries to authenticated;

do $$
begin
  execute 'drop trigger if exists change_log_aiud on public.preplanner_entries';
  execute 'create trigger change_log_aiud
     after insert or update or delete on public.preplanner_entries
     for each row execute function public.change_log_capture()';
end
$$;

create or replace function public.move_household_preplanner(source_id uuid, target_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
begin
  if source_id is null or target_id is null or source_id = target_id then
    raise exception 'Choose two different contacts.' using errcode = '22023';
  end if;
  if auth.uid() is null
     or not public.can_edit_household(source_id)
     or not public.can_edit_household(target_id) then
    raise exception 'You can''t move Pre-planner entries between these contacts.' using errcode = '42501';
  end if;

  update public.preplanner_entries
     set household_id = target_id
   where household_id = source_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.move_household_preplanner(uuid, uuid) from public;
grant execute on function public.move_household_preplanner(uuid, uuid) to authenticated;
