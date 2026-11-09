-- 1.8.25: a bochur only sees shared contacts that sit in his shliach's territory.
-- can_see_household_core is security definer (no self-referencing RLS on households from the policy body beyond the soft-hide check already present).

create or replace function public.can_see_household_core(p_hid uuid, p_org uuid, p_owner uuid, p_shared boolean, p_state text, p_city text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = p_org
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        (
          p.role = 'admin'
          or not exists (
            select 1 from public.households hx
            where hx.id = p_hid and hx.deleted_by_shliach_at is not null
          )
        )
        and case when public.role_is_bochur(p.role) then
          exists (select 1 from public.contact_shares s where s.household_id = p_hid and s.bochur_id = p.id)
          and p.leader_id is not null
          and public.contact_in_territory(p_state, p_city, p.leader_id)
        else (
          (
            p.role = 'admin'
            and (
              p_shared
              or p_owner is null
              or not exists (select 1 from public.profiles owner where owner.id = p_owner and owner.role = 'shliach')
            )
          )
          or p_owner = p.id
          or (p.leader_id is not null and p_owner = p.leader_id)
          or exists (select 1 from public.profiles member where member.id = p_owner and member.leader_id = p.id)
          or (
            p.role = 'shliach'
            and p_shared
            and public.contact_in_territory(p_state, p_city, coalesce(p.leader_id, p.id))
          )
          or (
            p.role = 'limited'
            and exists (
              select 1 from public.route_stops rs
              join public.route_assignments ra on ra.route_id = rs.route_id
              where rs.household_id = p_hid and ra.user_id = p.id
            )
          )
        ) end
      )
  )
$function$;


-- Who created the contact (for bochur "new people he found"). Defaults to auth.uid() on insert.
alter table public.households
  add column if not exists created_by uuid references auth.users(id);

-- Backfill without the access trigger (it checks the caller's territory).
alter table public.households disable trigger enforce_household_access;
update public.households set created_by = owner_id where created_by is null and owner_id is not null;
alter table public.households enable trigger enforce_household_access;

create or replace function public.households_set_created_by()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists households_set_created_by on public.households;
create trigger households_set_created_by
  before insert on public.households
  for each row execute function public.households_set_created_by();
