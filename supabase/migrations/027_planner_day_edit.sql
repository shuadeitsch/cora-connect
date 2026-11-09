-- 1.8.25: per-day bochur edit flag; settings bochurim_edit_planner is the default for new days.
-- Never subquery a table inside its own RLS policy; use security-definer helpers for cross-table checks.

alter table public.planner_days
  add column if not exists editable_by_bochurim boolean not null default false;

-- Existing days stay not editable unless a shliach opts them in (conservative; default was off).
update public.planner_days set editable_by_bochurim = false where editable_by_bochurim is distinct from true and editable_by_bochurim is distinct from false;

create or replace function public.planner_day_editable_by_me(p_day uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.planner_days d
    where d.id = p_day
      and d.org_id = public.my_org_id()
      and (
        public.is_admin()
        or public.my_role() = 'shliach'
        or (
          public.role_is_bochur(public.my_role())
          and public.access_open()
          and d.editable_by_bochurim
        )
      )
  )
$$;

revoke all on function public.planner_day_editable_by_me(uuid) from public, anon;
grant execute on function public.planner_day_editable_by_me(uuid) to authenticated;

-- Replace blanket can_edit_planner write policies with role + per-day rules.
drop policy if exists planner_days_write on public.planner_days;
create policy planner_days_write on public.planner_days for all to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (public.role_is_bochur(public.my_role()) and editable_by_bochurim)
    )
  )
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (public.role_is_bochur(public.my_role()) and editable_by_bochurim)
    )
  );

drop policy if exists planner_items_write on public.planner_items;
create policy planner_items_write on public.planner_items for all to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and public.planner_day_editable_by_me(day_id)
  )
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and public.planner_day_editable_by_me(day_id)
  );
