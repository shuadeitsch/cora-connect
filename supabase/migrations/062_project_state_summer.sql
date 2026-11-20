-- Per-project, per-state default for summer homes. No row = keep today's behavior (show all).
create table if not exists public.project_state_settings (
  project_id uuid not null references public.projects(id) on delete cascade,
  state text not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  include_summer_homes boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (project_id, state)
);

alter table public.project_state_settings enable row level security;

drop policy if exists project_state_settings_read on public.project_state_settings;
create policy project_state_settings_read on public.project_state_settings
  for select to authenticated using (org_id = public.my_org_id());

drop policy if exists project_state_settings_admin_write on public.project_state_settings;
create policy project_state_settings_admin_write on public.project_state_settings
  for all to authenticated
  using (public.is_admin() and org_id = public.my_org_id())
  with check (public.is_admin() and org_id = public.my_org_id());

revoke all on public.project_state_settings from anon;

-- Seed: Maine and New Hampshire. Summer projects include summer homes, Chanukah excludes them.
insert into public.project_state_settings (project_id, state, org_id, include_summer_homes)
select p.id, s.state, p.org_id, (p.name ilike 'summer%')
from public.projects p cross join (values ('ME'), ('NH')) as s(state)
where p.name ilike 'summer%' or p.name ilike 'chanukah%'
on conflict (project_id, state) do nothing;
