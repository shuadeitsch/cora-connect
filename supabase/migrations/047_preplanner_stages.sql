-- 1.8.62: Pre-planner stages (Reached out / Confirmed visits) and a project on each entry.
-- The table is empty, so requested_date/time can become nullable without a data migration.

alter table public.preplanner_entries
  alter column requested_date drop not null,
  alter column requested_time drop not null;

alter table public.preplanner_entries
  add column if not exists stage text not null default 'reached_out',
  add column if not exists reached_date date,
  add column if not exists reached_time time,
  add column if not exists follow_up_how text,
  add column if not exists notes_log jsonb not null default '[]'::jsonb,
  add column if not exists project_id uuid references public.projects (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'preplanner_stage_check'
      and conrelid = 'public.preplanner_entries'::regclass
  ) then
    alter table public.preplanner_entries
      add constraint preplanner_stage_check check (stage in ('reached_out', 'confirmed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'preplanner_follow_up_how_check'
      and conrelid = 'public.preplanner_entries'::regclass
  ) then
    alter table public.preplanner_entries
      add constraint preplanner_follow_up_how_check check (
        follow_up_how is null
        or follow_up_how in ('email', 'text', 'whatsapp', 'phone', 'in_person', 'other')
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'preplanner_confirmed_when_check'
      and conrelid = 'public.preplanner_entries'::regclass
  ) then
    alter table public.preplanner_entries
      add constraint preplanner_confirmed_when_check check (
        stage <> 'confirmed'
        or (requested_date is not null and requested_time is not null)
      );
  end if;
end
$$;

create index if not exists preplanner_entries_stage_date_idx
  on public.preplanner_entries (org_id, stage, reached_date, reached_time);

create index if not exists preplanner_entries_project_idx
  on public.preplanner_entries (project_id);

comment on column public.preplanner_entries.stage is
  'reached_out: a contact the user reached, visit date optional. confirmed: visit date and time are required; only these feed the Daily planner strip.';
comment on column public.preplanner_entries.notes_log is
  'Timestamped back-and-forth notes: [{at, text, by}].';
