-- 1.8.22: shliach soft-hide, share-all-bochurim default, planner edits, hide admins from shliach.
-- Idempotent. Target: pahrtdszegtowrfknqtf only.

-- Soft hide by shliach (separate from admin deleted_at).
alter table public.households
  add column if not exists deleted_by_shliach_at timestamptz;
alter table public.households
  add column if not exists deleted_by_shliach_by uuid references public.profiles(id) on delete set null;

create index if not exists households_deleted_by_shliach_idx
  on public.households (deleted_by_shliach_at)
  where deleted_by_shliach_at is not null;

-- Shliach settings: share new contacts with all his bochurim; let them edit the planner.
alter table public.profiles
  add column if not exists share_new_with_bochurim boolean not null default false;
alter table public.profiles
  add column if not exists bochurim_edit_planner boolean not null default false;

alter table public.profiles
  add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists profiles_project_idx on public.profiles (project_id);

-- See-contact: shliach/bochur never see soft-hidden rows; admins still do.
create or replace function public.can_see_household_core(
  p_hid uuid, p_org uuid, p_owner uuid, p_shared boolean, p_state text, p_city text
)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = p_org
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        -- Soft-hidden by a shliach: only admins keep seeing the row.
        (
          p.role = 'admin'
          or not exists (
            select 1 from public.households hx
            where hx.id = p_hid and hx.deleted_by_shliach_at is not null
          )
        )
        and case when public.role_is_bochur(p.role) then
          exists (select 1 from public.contact_shares s where s.household_id = p_hid and s.bochur_id = p.id)
        else (
          (
            p.role = 'admin'
            and (
              p_shared
              or p_owner is null
              or not exists (select 1 from public.profiles owner where owner.id = p_owner and owner.role = 'shliach')
            )
          )
          or p_owner = p.id
          or (p.leader_id is not null and p_owner = p.leader_id)
          or exists (select 1 from public.profiles member where member.id = p_owner and member.leader_id = p.id)
          or (
            p.role = 'shliach'
            and p_shared
            and public.contact_in_territory(p_state, p_city, coalesce(p.leader_id, p.id))
          )
          or (
            p.role = 'limited'
            and exists (
              select 1 from public.route_stops rs
              join public.route_assignments ra on ra.route_id = rs.route_id
              where rs.household_id = p_hid and ra.user_id = p.id
            )
          )
        ) end
      )
  )
$$;

create or replace function public.can_see_household(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.can_see_household_core(h.id, h.org_id, h.owner_id, h.shared_with_cora, h.state, h.city)
    from public.households h where h.id = hid
  ), false)
$$;

create or replace function public.can_see_household_row(h public.households)
returns boolean language sql stable security definer set search_path = public
as $$ select public.can_see_household_core(h.id, h.org_id, h.owner_id, h.shared_with_cora, h.state, h.city) $$;

-- Soft-hide / restore rules + keep non-admins from touching deleted_at.
create or replace function public.enforce_household_access()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare
  actor public.profiles%rowtype;
  book uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.status <> 'approved' or (actor.expires_at is not null and actor.expires_at < current_date) then
    raise exception 'You cannot edit contacts yet';
  end if;

  if actor.role = 'admin' then
    if new.owner_id is null then
      new.owner_id := actor.id;
    end if;
    if exists (
      select 1 from public.profiles owner
      where owner.id = new.owner_id and owner.role = 'shliach'
    ) then
      if btrim(coalesce(new.state, '')) = '' then
        new.state := coalesce(public.territory_state(new.owner_id), '');
      end if;
      if btrim(coalesce(new.state, '')) <> ''
         and not public.state_in_territory(new.state, new.city, new.owner_id) then
        raise exception 'That contact is outside the shliach territory';
      end if;
    end if;
    return new;
  end if;

  -- Non-admins never set the real admin soft-delete.
  if tg_op = 'UPDATE' then
    new.deleted_at := old.deleted_at;
  else
    new.deleted_at := null;
  end if;

  book := coalesce(actor.leader_id, actor.id);
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
    if old.owner_id is distinct from book then
      new.shared_with_cora := old.shared_with_cora;
    end if;
  else
    new.owner_id := book;
    new.deleted_by_shliach_at := null;
    new.deleted_by_shliach_by := null;
  end if;

  -- Soft-hide: only a shliach, and only on contacts in his state.
  if actor.role = 'shliach' then
    if tg_op = 'UPDATE'
       and (
         new.deleted_by_shliach_at is distinct from old.deleted_by_shliach_at
         or new.deleted_by_shliach_by is distinct from old.deleted_by_shliach_by
       ) then
      if not public.contact_in_territory(coalesce(new.state, old.state), coalesce(new.city, old.city), actor.id)
         and coalesce(old.owner_id, new.owner_id) is distinct from actor.id
         and not exists (
           select 1 from public.profiles member
           where member.id = coalesce(old.owner_id, new.owner_id) and member.leader_id = actor.id
         ) then
        raise exception 'You can only hide contacts in your state';
      end if;
      if new.deleted_by_shliach_at is not null then
        new.deleted_by_shliach_by := actor.id;
        new.deleted_by_shliach_at := coalesce(new.deleted_by_shliach_at, now());
      else
        new.deleted_by_shliach_by := null;
      end if;
    end if;
  else
    -- Bochur / others cannot touch soft-hide columns.
    if tg_op = 'UPDATE' then
      new.deleted_by_shliach_at := old.deleted_by_shliach_at;
      new.deleted_by_shliach_by := old.deleted_by_shliach_by;
    end if;
  end if;

  if btrim(coalesce(new.state, '')) = '' then
    new.state := coalesce(public.territory_state(book), '');
  end if;
  if btrim(coalesce(new.state, '')) <> ''
     and not public.state_in_territory(new.state, new.city, book) then
    raise exception 'That contact is outside your territory';
  end if;
  return new;
end;
$function$;

-- Profiles: a shliach sees only himself and his bochurim (never Cora admins).
-- Never subquery public.profiles inside profiles RLS — that causes infinite recursion.
-- Use security-definer helpers (my_leader_id, is_admin, my_role, my_org_id, is_approved) instead.
create or replace function public.my_leader_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select leader_id from public.profiles where id = auth.uid() $$;

revoke all on function public.my_leader_id() from public, anon;
grant execute on function public.my_leader_id() to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      org_id = public.my_org_id()
      and public.is_approved()
      and (
        public.is_admin()
        or public.my_role() in ('visitor', 'limited')
        or (
          public.my_role() = 'shliach'
          and leader_id = auth.uid()
          and public.role_is_bochur(role)
        )
        or (
          public.role_is_bochur(public.my_role())
          and (
            id = public.my_leader_id()
            or (leader_id = public.my_leader_id() and public.role_is_bochur(role))
          )
        )
      )
    )
  );

-- Profile privilege guard (018 + shliach prefs + bochur project_id).
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
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
  new.project_id := old.project_id;
  return new;
end;
$function$;

-- Planner: shliach can write; bochur can view always, write when his shliach allows.
create or replace function public.can_edit_planner()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        p.role = 'admin'
        or p.role = 'shliach'
        or (
          public.role_is_bochur(p.role)
          and exists (
            select 1 from public.profiles s
            where s.id = p.leader_id and s.role = 'shliach' and s.bochurim_edit_planner
          )
        )
      )
  )
$$;

drop policy if exists planner_days_select on public.planner_days;
create policy planner_days_select on public.planner_days for select
  using (org_id = public.my_org_id() and public.access_open());

drop policy if exists planner_items_select on public.planner_items;
create policy planner_items_select on public.planner_items for select
  using (org_id = public.my_org_id() and public.access_open());

drop policy if exists planner_days_write on public.planner_days;
create policy planner_days_write on public.planner_days for all
  using (org_id = public.my_org_id() and public.can_edit_planner())
  with check (org_id = public.my_org_id() and public.can_edit_planner());

drop policy if exists planner_items_write on public.planner_items;
create policy planner_items_write on public.planner_items for all
  using (org_id = public.my_org_id() and public.can_edit_planner())
  with check (org_id = public.my_org_id() and public.can_edit_planner());

grant execute on function public.can_edit_planner() to authenticated;

-- Share one contact with every active bochur under the signed-in shliach (or admin acting).
create or replace function public.share_contact_with_all_bochurim(p_household uuid, p_share boolean)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  n integer := 0;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.status <> 'approved' then
    raise exception 'Sign in again.';
  end if;
  if actor.role <> 'shliach' and actor.role <> 'admin' then
    raise exception 'Only a shliach can share with bochurim.';
  end if;
  if not public.can_see_household(p_household) then
    raise exception 'You cannot share that contact.';
  end if;
  if p_share then
    insert into public.contact_shares (household_id, bochur_id, org_id, shared_by)
    select p_household, b.id, actor.org_id, actor.id
    from public.profiles b
    where public.role_is_bochur(b.role)
      and b.status = 'approved'
      and (b.expires_at is null or b.expires_at >= current_date)
      and (
        (actor.role = 'shliach' and b.leader_id = actor.id)
        or actor.role = 'admin'
      )
    on conflict do nothing;
    get diagnostics n = row_count;
  else
    delete from public.contact_shares s
    using public.profiles b
    where s.household_id = p_household
      and s.bochur_id = b.id
      and public.role_is_bochur(b.role)
      and (
        (actor.role = 'shliach' and b.leader_id = actor.id)
        or actor.role = 'admin'
      );
    get diagnostics n = row_count;
  end if;
  return n;
end;
$$;

revoke all on function public.share_contact_with_all_bochurim(uuid, boolean) from public, anon;
grant execute on function public.share_contact_with_all_bochurim(uuid, boolean) to authenticated;

-- Visit activities (1.8.22): multi-select chips + write-ins on contact_visits.
alter table public.contact_visits
  add column if not exists activities text[] not null default '{}';
