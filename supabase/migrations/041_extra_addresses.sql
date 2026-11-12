-- 1.8.55: extra addresses on a contact, and a visit move used when merging.

alter table public.households
  add column if not exists extra_addresses jsonb not null default '[]'::jsonb;

comment on column public.households.extra_addresses is
  'Additional addresses on the contact: [{street, city, state, zip, label}].';

-- Move every visit (including soft-deleted ones) from one contact to another.
-- Used by merge so History on the surviving card has both sides.
create or replace function public.move_household_visits(source_id uuid, target_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_contact integer := 0;
  n_visit integer := 0;
begin
  if source_id is null or target_id is null or source_id = target_id then
    raise exception 'Choose two different contacts.' using errcode = '22023';
  end if;
  if auth.uid() is null
     or not public.can_edit_household(source_id)
     or not public.can_edit_household(target_id) then
    raise exception 'You can''t move visits between these contacts.' using errcode = '42501';
  end if;

  update public.contact_visits
     set household_id = target_id
   where household_id = source_id;
  get diagnostics n_contact = row_count;

  update public.visits
     set household_id = target_id
   where household_id = source_id;
  get diagnostics n_visit = row_count;

  return n_contact + n_visit;
end;
$$;

revoke all on function public.move_household_visits(uuid, uuid) from public;
grant execute on function public.move_household_visits(uuid, uuid) to authenticated;
