-- Carrier line type for each saved number (from a phone lookup), keyed by the number's last 10 digits,
-- e.g. {"2075551234": "mobile", "2075550000": "landline"}. Mass texts skip landlines and fixed (home) VoIP lines.
alter table public.people add column if not exists phone_line_types jsonb not null default '{}'::jsonb;

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
  case when public.can_view_contact() then coalesce(pe.phone3, '') else '' end as phone3,
  pe.email_opt_out,
  pe.sms_opt_out,
  pe.whatsapp_opt_out,
  case when public.can_view_contact() then pe.extra_phones else '{}'::text[] end as extra_phones,
  case when public.can_view_contact() then pe.phone_line_types else '{}'::jsonb end as phone_line_types
from public.people pe
where public.can_see_household(pe.household_id);

grant select on public.people_visible to authenticated;
