-- Remove a single visit from a contact (1.5.5).
-- Run after 012_contact_visit_log.sql. Safe to run again. Does not edit earlier files.
-- Applied to the Cora project (pahrtdszegtowrfknqtf) through the management API.
--
-- public.visits (the Reports log) already has deleted_at (008). This hides
-- soft-deleted rows from History, Reports, and the dashboard, and lets the
-- same people who can remove the matching contact_visits row set deleted_at:
-- anyone who can edit that contact, plus the old rule (admin, or the person
-- who logged the visit).

alter table public.visits add column if not exists deleted_at timestamptz;

-- Same columns and security as 001_init.sql. Only the deleted_at filter is new.
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
  and public.can_see_household(v.household_id)
  and v.deleted_at is null;

grant select on public.visits_visible to authenticated;

drop policy if exists visits_update on public.visits;

create policy visits_update on public.visits
  for update to authenticated
  using (
    org_id = public.my_org_id()
    and (
      (public.can_log_visit() and (public.is_admin() or visitor_id = auth.uid()))
      or (public.can_see_household(household_id) and public.can_edit_household(household_id))
    )
  )
  with check (
    org_id = public.my_org_id()
    and (
      public.can_log_visit()
      or (public.can_see_household(household_id) and public.can_edit_household(household_id))
    )
  );
