-- Outreach visits, optional log fields, undo, and possible duplicates.
-- Run after 007_contact_save.sql. Safe to run again. Does not edit earlier files.
--
-- public.visits is the log-a-visit / reports table. Do not drop or replace it.
-- Contact Visit History lives in public.contact_visits (many rows per contact).
-- Every column except the contact link is optional.
--
-- Always GRANT explicitly. A missing SELECT on visits and people made
-- PostgREST report "permission denied for table visits" after a write.

create table if not exists public.contact_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  visited text not null default '',
  reaction text,
  notes text not null default '',
  visit_date date,
  arrived text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  import_batch_id uuid,
  deleted_at timestamptz
);

alter table public.contact_visits add column if not exists import_batch_id uuid;
alter table public.contact_visits add column if not exists deleted_at timestamptz;
alter table public.contact_visits add column if not exists arrived text not null default '';

alter table public.contact_visits drop constraint if exists contact_visits_reaction_check;
alter table public.contact_visits
  add constraint contact_visits_reaction_check
  check (
    reaction is null
    or reaction in ('very_happy', 'warm', 'neutral', 'cold', 'very_cold')
  );

create index if not exists contact_visits_household_idx on public.contact_visits (household_id);
create index if not exists contact_visits_import_batch_idx on public.contact_visits (import_batch_id);

-- A log can be saved with only the contact link.
alter table public.visits alter column visit_date drop not null;
alter table public.visits alter column status drop not null;
alter table public.visits add column if not exists deleted_at timestamptz;

alter table public.households add column if not exists deleted_at timestamptz;
alter table public.households add column if not exists import_batch_id uuid;
alter table public.households add column if not exists possible_duplicate boolean not null default false;
alter table public.households add column if not exists duplicate_of uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'households_duplicate_of_fkey'
  ) then
    alter table public.households
      add constraint households_duplicate_of_fkey
      foreign key (duplicate_of) references public.households (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'households_duplicate_of_not_self'
  ) then
    alter table public.households
      add constraint households_duplicate_of_not_self
      check (duplicate_of is null or duplicate_of <> id);
  end if;
end $$;

create index if not exists households_import_batch_idx on public.households (import_batch_id);
create index if not exists households_possible_duplicate_idx
  on public.households (possible_duplicate)
  where possible_duplicate;

-- Copy the old single project / reaction / notes / year-arrived onto one
-- visit when the contact does not have visit history yet. Old columns stay.
insert into public.contact_visits (org_id, household_id, visited, reaction, notes, arrived, created_at)
select
  h.org_id,
  h.id,
  coalesce(p.name, ''),
  h.visit_reaction,
  coalesce(h.notes, ''),
  coalesce((
    select h.custom_fields ->> d.id::text
    from public.custom_field_defs d
    where d.org_id = h.org_id
      and d.name ilike '%arriv%'
    limit 1
  ), ''),
  h.created_at
from public.households h
left join public.projects p on p.id = h.project_id
where h.deleted_at is null
  and not exists (
    select 1 from public.contact_visits cv where cv.household_id = h.id
  )
  and (
    coalesce(p.name, '') <> ''
    or h.visit_reaction is not null
    or btrim(coalesce(h.notes, '')) <> ''
    or exists (
      select 1
      from public.custom_field_defs d
      where d.org_id = h.org_id
        and d.name ilike '%arriv%'
        and btrim(coalesce(h.custom_fields ->> d.id::text, '')) <> ''
    )
  );

alter table public.contact_visits enable row level security;

-- Policies call can_see_household / can_edit_household on the contact id.
-- Those functions read the committed household, not contact_visits, so an
-- insert does not depend on SELECT of the new visit row. The app still
-- does not read the row back. Restoring a soft-deleted contact is an
-- UPDATE of deleted_at by the same user who can edit that contact.
drop policy if exists contact_visits_select on public.contact_visits;
drop policy if exists contact_visits_insert on public.contact_visits;
drop policy if exists contact_visits_update on public.contact_visits;
drop policy if exists contact_visits_delete on public.contact_visits;

create policy contact_visits_select on public.contact_visits
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_see_household(household_id)
  );

create policy contact_visits_insert on public.contact_visits
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.can_edit_household(household_id)
  );

create policy contact_visits_update on public.contact_visits
  for update to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_edit_household(household_id)
  )
  with check (
    org_id = public.my_org_id()
    and public.can_edit_household(household_id)
  );

create policy contact_visits_delete on public.contact_visits
  for delete to authenticated
  using (
    org_id = public.my_org_id()
    and public.can_edit_household(household_id)
  );

-- Same grants the live database needed, including this new table.
grant select, insert, update, delete on public.contact_visits to authenticated;
grant select, insert, update, delete on public.visits to authenticated;
grant select, insert, update, delete on public.people to authenticated;
