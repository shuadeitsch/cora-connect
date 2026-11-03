-- Visit status on contact history. Null means Completed.
-- Deferred Maine-import notes become deferred visits. The contact note is copied, not changed.

alter table public.contact_visits add column if not exists status text;

alter table public.contact_visits drop constraint if exists contact_visits_status_check;
alter table public.contact_visits
  add constraint contact_visits_status_check
  check (status is null or status in ('completed', 'deferred'));

insert into public.contact_visits (org_id, household_id, visited, notes, visit_date, status, created_at)
select
  h.org_id,
  h.id,
  'Summer 5786',
  h.notes,
  to_date((regexp_match(h.notes, 'Summer 5786 \(([^)]+)\)'))[1], 'Mon FMDD, YYYY'),
  'deferred',
  h.created_at
from public.households h
where h.deleted_at is null
  and h.notes ~* 'Summer 5786 \([^)]+\): Deferred'
  and not exists (
    select 1
    from public.contact_visits cv
    where cv.household_id = h.id
      and cv.deleted_at is null
  );
