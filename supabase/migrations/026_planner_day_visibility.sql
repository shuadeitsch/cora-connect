-- 1.8.24: per-day planner visibility for bochurim + shliach default pref.
-- RULE: never subquery a table inside its own RLS policy; use security-definer helpers.

alter table public.profiles
  add column if not exists bochurim_see_planner_default boolean not null default true;

alter table public.planner_days
  add column if not exists visible_to_bochurim boolean not null default true;

-- Existing days: backfill visible.
update public.planner_days set visible_to_bochurim = true where visible_to_bochurim is distinct from true;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if lower(old.email) = 'shuadeitsch@gmail.com' then
    new.role := 'admin';
    new.status := 'approved';
    new.expires_at := null;
    new.can_view_history := true;
    new.can_view_contact := true;
    new.can_edit := true;
    new.email := old.email;
    new.org_id := old.org_id;
    new.leader_id := old.leader_id;
    return new;
  end if;

  if auth.uid() is not null and auth.uid() = new.id and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.expires_at := old.expires_at;
    new.can_view_history := old.can_view_history;
    new.can_view_contact := old.can_view_contact;
    new.can_edit := old.can_edit;
    new.email := old.email;
    new.org_id := old.org_id;
    new.leader_id := old.leader_id;
    new.admin_approved_at := old.admin_approved_at;
    new.admin_approved_by := old.admin_approved_by;
    new.final_approved_at := old.final_approved_at;
    new.project_id := case when public.role_is_bochur(old.role) then coalesce(new.project_id, old.project_id) else old.project_id end;
    if old.role <> 'shliach' then
      new.share_new_with_bochurim := old.share_new_with_bochurim;
      new.bochurim_edit_planner := old.bochurim_edit_planner;
      new.bochurim_see_planner_default := old.bochurim_see_planner_default;
    end if;
    return new;
  end if;

  if auth.uid() is not null and public.is_admin() and auth.uid() is distinct from new.id then
    if new.role = 'shliach' and new.status = 'approved' and not exists (select 1 from public.territories t where t.user_id = new.id and btrim(coalesce(t.state, '')) <> '') then
      raise exception 'A shliach needs a state before approval.';
    end if;
    if public.role_is_bochur(new.role) then
      if new.leader_id is null or not exists (select 1 from public.profiles s where s.id = new.leader_id and s.role = 'shliach') then
        raise exception 'Pick the shliach for this bochur.';
      end if;
      if new.status = 'approved' and old.final_approved_at is null and new.final_approved_at is null then
        new.status := 'pending';
        new.admin_approved_at := coalesce(old.admin_approved_at, now());
        new.admin_approved_by := coalesce(old.admin_approved_by, auth.uid());
      end if;
    end if;
    return new;
  end if;

  if auth.uid() is not null and auth.uid() is distinct from new.id and public.leads_bochur(old.id) then
    new.role := old.role;
    new.org_id := old.org_id;
    new.email := old.email;
    new.leader_id := old.leader_id;
    new.can_view_history := old.can_view_history;
    new.can_view_contact := old.can_view_contact;
    new.can_edit := old.can_edit;
    new.admin_approved_at := old.admin_approved_at;
    new.admin_approved_by := old.admin_approved_by;
    new.share_new_with_bochurim := old.share_new_with_bochurim;
    new.bochurim_edit_planner := old.bochurim_edit_planner;
    new.bochurim_see_planner_default := old.bochurim_see_planner_default;
    -- Shliach may change the bochur's project.
    if new.project_id is distinct from old.project_id and new.project_id is not null then
      if not exists (select 1 from public.projects p where p.id = new.project_id and p.org_id = old.org_id) then
        raise exception 'Pick a project on this account.';
      end if;
    end if;
    if new.status not in ('approved', 'disabled') then new.status := old.status; end if;
    if new.status = 'approved' and old.admin_approved_at is null then
      raise exception 'A Cora admin must approve this bochur first.';
    end if;
    if new.status = 'approved' and old.final_approved_at is null then
      new.final_approved_at := now();
      new.expires_at := (current_date + interval '1 month')::date;
    else
      new.final_approved_at := old.final_approved_at;
    end if;
    if new.expires_at is null or new.expires_at > (current_date + interval '1 month')::date then
      new.expires_at := least(coalesce(new.expires_at, old.expires_at), (current_date + interval '1 month')::date);
      if new.expires_at is null then new.expires_at := (current_date + interval '1 month')::date; end if;
    end if;
    return new;
  end if;

  new.role := old.role;
  new.org_id := old.org_id;
  new.email := old.email;
  new.status := old.status;
  new.expires_at := old.expires_at;
  new.can_view_history := old.can_view_history;
  new.can_view_contact := old.can_view_contact;
  new.can_edit := old.can_edit;
  new.leader_id := old.leader_id;
  new.admin_approved_at := old.admin_approved_at;
  new.admin_approved_by := old.admin_approved_by;
  new.final_approved_at := old.final_approved_at;
  new.share_new_with_bochurim := old.share_new_with_bochurim;
  new.bochurim_edit_planner := old.bochurim_edit_planner;
  new.bochurim_see_planner_default := old.bochurim_see_planner_default;
  new.project_id := old.project_id;
  return new;
end;
$function$;

-- Bochur may read a planner day only when visible_to_bochurim (column on the row; no self-subquery).
drop policy if exists planner_days_select on public.planner_days;
create policy planner_days_select on public.planner_days for select to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      not public.role_is_bochur(public.my_role())
      or visible_to_bochurim
    )
  );

create or replace function public.planner_day_visible_to_me(p_day uuid)
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
        not public.role_is_bochur(public.my_role())
        or d.visible_to_bochurim
      )
  )
$$;

revoke all on function public.planner_day_visible_to_me(uuid) from public, anon;
grant execute on function public.planner_day_visible_to_me(uuid) to authenticated;

drop policy if exists planner_items_select on public.planner_items;
create policy planner_items_select on public.planner_items for select to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and public.planner_day_visible_to_me(day_id)
  );
