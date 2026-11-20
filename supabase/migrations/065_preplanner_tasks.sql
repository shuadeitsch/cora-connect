-- Pre-planner "Tasks": free-text follow-up tasks per state. Phone and email are for tap-to-call / mailto only.
create table if not exists public.preplanner_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  state text not null default '',
  task text not null check (btrim(task) <> ''),
  phone text not null default '',
  email text not null default '',
  holding text not null default '',
  next_follow_up date,
  done boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists preplanner_tasks_org_state_idx on public.preplanner_tasks (org_id, state, next_follow_up);

alter table public.preplanner_tasks enable row level security;

-- Same state rules as contacts: admins see all; a shliach his territory (a bochur his shliach's); plus your own tasks.
create or replace function public.can_see_task(p_org uuid, p_state text, p_creator uuid)
returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = p_org and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        p.role::text = 'admin'
        or p_creator = p.id
        or (btrim(coalesce(p_state, '')) <> '' and public.contact_in_territory(p_state, '', coalesce(p.leader_id, p.id)))
      )
  );
$function$;
revoke all on function public.can_see_task(uuid, text, uuid) from public, anon;
grant execute on function public.can_see_task(uuid, text, uuid) to authenticated;

drop policy if exists preplanner_tasks_all on public.preplanner_tasks;
create policy preplanner_tasks_all on public.preplanner_tasks for all to authenticated
  using (org_id = public.my_org_id() and public.access_open() and public.role_allows('preplanner') and public.can_see_task(org_id, state, created_by))
  with check (org_id = public.my_org_id() and public.access_open() and public.role_allows('preplanner') and public.can_see_task(org_id, state, created_by));
revoke all on table public.preplanner_tasks from anon;
grant select, insert, update, delete on table public.preplanner_tasks to authenticated;
