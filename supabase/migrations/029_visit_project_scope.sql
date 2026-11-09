-- 1.8.25: bochur may update/soft-delete only visits tagged with his project_id.
-- Helpers are security definer and never subquery the visits tables from their own policies.

alter table public.visits
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.contact_visits
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Backfill from the contact's project, then from season name matching a project.
update public.visits v
set project_id = h.project_id
from public.households h
where v.project_id is null and h.id = v.household_id and h.project_id is not null;

update public.contact_visits cv
set project_id = h.project_id
from public.households h
where cv.project_id is null and h.id = cv.household_id and h.project_id is not null;

update public.contact_visits cv
set project_id = p.id
from public.projects p
where cv.project_id is null
  and nullif(trim(cv.visited), '') is not null
  and lower(trim(cv.visited)) = lower(trim(p.name))
  and p.org_id = cv.org_id;

create or replace function public.my_project_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select project_id from public.profiles where id = auth.uid()
$$;

-- True when the signed-in user may update/soft-delete this visit row (by project + authorship rules).
-- Does not read public.visits / public.contact_visits.
create or replace function public.can_mutate_visit_row(p_org uuid, p_household uuid, p_project uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.org_id = p_org
      and me.status = 'approved'
      and (me.expires_at is null or me.expires_at >= current_date)
      and (
        me.role = 'admin'
        or (
          public.can_see_household(p_household)
          and public.can_edit_household(p_household)
        )
        or (
          public.can_log_visit()
          and p_author = me.id
          and (
            not public.role_is_bochur(me.role)
            or (p_project is not null and p_project = me.project_id)
          )
        )
      )
  )
$$;

drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits
  for update to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_mutate_visit_row(org_id, household_id, project_id, visitor_id)
  )
  with check (
    org_id = public.my_org_id()
    and public.can_mutate_visit_row(org_id, household_id, project_id, visitor_id)
  );

-- Soft-delete stays an update; hard delete remains admin-only.
drop policy if exists visits_delete on public.visits;
create policy visits_delete on public.visits
  for delete to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

drop policy if exists contact_visits_update on public.contact_visits;
create policy contact_visits_update on public.contact_visits
  for update to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
    and public.can_mutate_visit_row(org_id, household_id, project_id, created_by)
  )
  with check (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
    and public.can_mutate_visit_row(org_id, household_id, project_id, created_by)
  );

drop policy if exists contact_visits_delete on public.contact_visits;
create policy contact_visits_delete on public.contact_visits
  for delete to authenticated
  using (
    org_id = public.my_org_id()
    and (
      public.is_admin()
      or public.can_mutate_visit_row(org_id, household_id, project_id, created_by)
    )
  );

-- Tag new visits with the logger's project when they are a bochur (or leave null for others).
create or replace function public.visits_set_project_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if new.project_id is null then
    pid := public.my_project_id();
    if pid is not null then
      new.project_id := pid;
    else
      select h.project_id into new.project_id from public.households h where h.id = new.household_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists visits_set_project_id on public.visits;
create trigger visits_set_project_id
  before insert on public.visits
  for each row execute function public.visits_set_project_id();

drop trigger if exists contact_visits_set_project_id on public.contact_visits;
create trigger contact_visits_set_project_id
  before insert on public.contact_visits
  for each row execute function public.visits_set_project_id();
