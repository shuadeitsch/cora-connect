-- 1.8.0 step 2 of 2: Shliach and Bochur access, enforced with RLS.
-- Chain of command: Cora admin -> shliach -> bochur.
-- Admin access is unchanged. No existing rows are changed or removed.
--   Shliach: sees and edits contacts he owns, his bochurim own, or that are shared with Cora in his state (territories).
--            Adds and updates visits on those. Cannot delete contacts or visits. Routes: only his own and his bochurim's.
--   Bochur:  needs admin approval (picks the shliach = leader_id) and then the shliach's approval.
--            Access ends at expires_at (1 month after final approval; the shliach can extend it) or when disabled.
--            Sees only contacts shared with him in contact_shares, with their full history. Can log visits on them.

create or replace function public.role_is_bochur(r public.user_role)
returns boolean language sql immutable set search_path = public
as $$ select r::text = 'bochur' $$;

-- Who approved what, for the two-step bochur approval.
alter table public.profiles add column if not exists admin_approved_at timestamptz;
alter table public.profiles add column if not exists admin_approved_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists final_approved_at timestamptz;

create table if not exists public.contact_shares (
  household_id uuid not null references public.households(id) on delete cascade,
  bochur_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  shared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, bochur_id)
);
create index if not exists contact_shares_bochur_idx on public.contact_shares (bochur_id);
alter table public.contact_shares enable row level security;

-- Is the signed-in user an approved, not-expired shliach who leads this bochur?
create or replace function public.leads_bochur(p_bochur uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    join public.profiles b on b.id = p_bochur and b.leader_id = me.id and public.role_is_bochur(b.role)
    where me.id = auth.uid() and me.role = 'shliach' and me.status = 'approved'
      and (me.expires_at is null or me.expires_at >= current_date)
  )
$$;

-- One rule for "may see this contact", used by both the row and the id versions.
create or replace function public.can_see_household_core(p_hid uuid, p_org uuid, p_owner uuid, p_shared boolean, p_state text, p_city text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = p_org
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        case when public.role_is_bochur(p.role) then
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

-- Edit contact info. A bochur never edits contact info. A shliach also edits Cora-shared contacts in his state.
create or replace function public.can_edit_household_core(p_org uuid, p_owner uuid, p_shared boolean, p_state text, p_city text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = p_org
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and not public.role_is_bochur(p.role)
      and (p.role = 'admin' or p.can_edit or p.role = 'shliach')
      and (
        p.role = 'admin'
        or p_owner = p.id
        or (p.leader_id is not null and p_owner = p.leader_id)
        or exists (select 1 from public.profiles member where member.id = p_owner and member.leader_id = p.id)
        or (p.role = 'shliach' and p_shared and public.contact_in_territory(p_state, p_city, coalesce(p.leader_id, p.id)))
      )
  )
$$;

create or replace function public.can_edit_household(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.can_edit_household_core(h.org_id, h.owner_id, h.shared_with_cora, h.state, h.city)
    from public.households h where h.id = hid
  ), false)
$$;

create or replace function public.can_edit_household_row(h public.households)
returns boolean language sql stable security definer set search_path = public
as $$ select public.can_edit_household_core(h.org_id, h.owner_id, h.shared_with_cora, h.state, h.city) $$;

-- Deleting contacts or visits: never a shliach or bochur.
create or replace function public.may_delete_contacts()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and role <> 'shliach' and not public.role_is_bochur(role)
  )
$$;

drop policy if exists households_delete on public.households;
create policy households_delete on public.households for delete
  using (public.can_edit_household_row(households.*) and public.can_see_household_row(households.*) and public.may_delete_contacts());

drop policy if exists contact_visits_delete on public.contact_visits;
create policy contact_visits_delete on public.contact_visits for delete
  using (org_id = public.my_org_id() and public.can_edit_household(household_id) and public.may_delete_contacts());

-- Logging visits: add bochur (only reaches contacts he can see, by the visit policies).
create or replace function public.can_log_visit()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role in ('admin', 'visitor', 'shliach') or public.role_is_bochur(role) or can_edit)
  )
$$;

-- Routes. Admin/visitor: unchanged (all org routes). Shliach: his own and his bochurim's. Bochur: his own.
-- Everyone: routes assigned to them. Expired or disabled accounts: none.
create or replace function public.can_see_route(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.routes r
    join public.profiles p on p.id = auth.uid() and p.org_id = r.org_id
    where r.id = rid
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        p.role in ('admin', 'visitor')
        or r.created_by = p.id
        or (p.role = 'shliach' and exists (select 1 from public.profiles m where m.id = r.created_by and m.leader_id = p.id))
        or exists (select 1 from public.route_assignments ra where ra.route_id = r.id and ra.user_id = p.id)
      )
  )
$$;

create or replace function public.can_build_routes()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role in ('admin', 'visitor', 'shliach') or public.role_is_bochur(role))
  )
$$;

-- Your own new route is readable right away (RETURNING), before can_see_route can find it.
drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes for select
  using (public.can_see_route(id) or (org_id = public.my_org_id() and created_by = auth.uid() and public.access_open()));
drop policy if exists routes_insert on public.routes;
create policy routes_insert on public.routes for insert
  with check (org_id = public.my_org_id() and public.can_build_routes() and created_by = auth.uid());
drop policy if exists routes_update on public.routes;
create policy routes_update on public.routes for update
  using (public.can_see_route(id) and public.can_build_routes())
  with check (org_id = public.my_org_id());
-- A shliach or bochur may delete his own routes; admins any (unchanged).
drop policy if exists routes_delete on public.routes;
create policy routes_delete on public.routes for delete
  using (org_id = public.my_org_id() and (public.is_admin() or (created_by = auth.uid() and public.can_build_routes())));

-- Stops: only on routes you can see, and (for shliach/bochur) only contacts you can see.
drop policy if exists stops_write on public.route_stops;
create policy stops_write on public.route_stops for all
  using (public.can_see_route(route_id) and public.can_build_routes())
  with check (
    public.can_see_route(route_id) and public.can_build_routes()
    and (public.my_role() in ('admin', 'visitor') or public.can_see_household(household_id))
  );
drop policy if exists stops_select on public.route_stops;
create policy stops_select on public.route_stops for select
  using (public.can_see_route(route_id) and (public.my_role() in ('admin', 'visitor') or public.can_see_household(household_id)));

-- Planner: a bochur sees nothing by default. Others unchanged (approved and not expired).
drop policy if exists planner_days_select on public.planner_days;
create policy planner_days_select on public.planner_days for select
  using (org_id = public.my_org_id() and public.access_open() and not public.role_is_bochur(public.my_role()));
drop policy if exists planner_items_select on public.planner_items;
create policy planner_items_select on public.planner_items for select
  using (org_id = public.my_org_id() and public.access_open() and not public.role_is_bochur(public.my_role()));

-- Sharing contacts with a bochur: admins, or the bochur's shliach for contacts he can see.
create policy contact_shares_select on public.contact_shares for select
  using (org_id = public.my_org_id() and (bochur_id = auth.uid() or public.is_admin() or public.leads_bochur(bochur_id)));
create policy contact_shares_insert on public.contact_shares for insert
  with check (
    org_id = public.my_org_id()
    and (public.is_admin() or (public.leads_bochur(bochur_id) and public.can_see_household(household_id)))
  );
create policy contact_shares_delete on public.contact_shares for delete
  using (org_id = public.my_org_id() and (public.is_admin() or public.leads_bochur(bochur_id)));

-- Profiles: a shliach may update his own bochurim (approve after admin, extend, disable).
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (org_id = public.my_org_id() and (public.is_admin() or id = auth.uid() or public.leads_bochur(id)))
  with check (org_id = public.my_org_id() and (public.is_admin() or id = auth.uid() or public.leads_bochur(id)));

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
  if auth.uid() is not null and public.is_admin() and auth.uid() is distinct from new.id then
    -- A shliach must have a state; a bochur must have a shliach.
    if new.role = 'shliach' and new.status = 'approved' and not exists (select 1 from public.territories t where t.user_id = new.id and btrim(coalesce(t.state, '')) <> '') then
      raise exception 'A shliach needs a state before approval.';
    end if;
    if public.role_is_bochur(new.role) then
      if new.leader_id is null or not exists (select 1 from public.profiles s where s.id = new.leader_id and s.role = 'shliach') then
        raise exception 'Pick the shliach for this bochur.';
      end if;
      -- Admin approval is step one; the shliach gives final approval.
      if new.status = 'approved' and old.final_approved_at is null and new.final_approved_at is null then
        new.status := 'pending';
        new.admin_approved_at := coalesce(old.admin_approved_at, now());
        new.admin_approved_by := coalesce(old.admin_approved_by, auth.uid());
      end if;
    end if;
    return new;
  end if;
  -- Shliach acting on his own bochur: approve (after admin), extend, or disable. Nothing else.
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
    -- Extending: at most one month from today at a time.
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
  return new;
end;
$function$;

-- Contact edits by a non-admin no longer move the contact into their book; only new contacts get an owner.
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

  book := coalesce(actor.leader_id, actor.id);
  if tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
    if old.owner_id is distinct from book then
      new.shared_with_cora := old.shared_with_cora;
    end if;
  else
    new.owner_id := book;
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
