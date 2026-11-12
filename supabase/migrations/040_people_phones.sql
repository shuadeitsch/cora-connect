-- 1.8.51: Phone 2 and Phone 3 on people (nullable). Additive only.
-- RLS on people / households is unchanged. change_log already fires
-- AFTER INSERT OR UPDATE OR DELETE on people and stores to_jsonb(NEW/OLD),
-- so the new columns are captured automatically.

alter table public.people
  add column if not exists phone2 text,
  add column if not exists phone3 text;

comment on column public.people.phone2 is 'Optional second phone for a contact person.';
comment on column public.people.phone3 is 'Optional third phone for a contact person.';

-- Recreate the view so the new columns follow the same can_view_contact
-- redaction as phone. New columns are appended. Grants are reapplied.
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
  case when public.can_view_contact() then pe.whatsapp else '' end as whatsapp,
  case when public.can_view_contact() then coalesce(pe.phone2, '') else '' end as phone2,
  case when public.can_view_contact() then coalesce(pe.phone3, '') else '' end as phone3
from public.people pe
where public.can_see_household(pe.household_id);

grant select on public.people_visible to authenticated;
