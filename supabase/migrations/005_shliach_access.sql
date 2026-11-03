-- Shliach territories and Share with Cora. Run after 004_preapproved_chief_admins.sql.
-- Safe to run again. Does not edit earlier migrations.
-- Cora admins (role admin) see shared contacts from every state.
-- A shliach sees contacts he or his team own, plus shared contacts in his territory.
-- Unshared contacts stay off the Cora overview.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
      and e.enumlabel = 'shliach'
  ) then
    drop policy if exists routes_insert on public.routes;
    drop policy if exists routes_update on public.routes;
    drop policy if exists stops_write on public.route_stops;
    drop function if exists public.my_role();

    alter type public.user_role rename to user_role_old;
    create type public.user_role as enum ('admin', 'visitor', 'limited', 'shliach');

    alter table public.profiles alter column role drop default;
    alter table public.profiles
      alter column role type public.user_role
      using (role::text)::public.user_role;
    alter table public.profiles alter column role set default 'visitor';

    alter table public.invites alter column role drop default;
    alter table public.invites
      alter column role type public.user_role
      using (role::text)::public.user_role;
    alter table public.invites alter column role set default 'visitor';

    drop type public.user_role_old;
  end if;
end $$;

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles
  add column if not exists leader_id uuid references public.profiles (id) on delete set null;

alter table public.households
  add column if not exists shared_with_cora boolean not null default true;

alter table public.households
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

create index if not exists households_owner_idx on public.households (owner_id);

create table if not exists public.territories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  state text not null,
  area text not null default '',
  primary key (user_id, state, area)
);

alter table public.territories enable row level security;

insert into public.projects (id, org_id, name)
select gen_random_uuid(), o.id, v.name
from public.organizations o
cross join (values ('Summer 5786'), ('Chanukah 5787')) as v(name)
where not exists (
  select 1 from public.projects p
  where p.org_id = o.id and p.name = v.name
);

create or replace function public.state_code(value text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(value, '')))
    when 'al' then 'AL' when 'alabama' then 'AL'
    when 'ak' then 'AK' when 'alaska' then 'AK'
    when 'az' then 'AZ' when 'arizona' then 'AZ'
    when 'ar' then 'AR' when 'arkansas' then 'AR'
    when 'ca' then 'CA' when 'california' then 'CA'
    when 'co' then 'CO' when 'colorado' then 'CO'
    when 'ct' then 'CT' when 'connecticut' then 'CT'
    when 'de' then 'DE' when 'delaware' then 'DE'
    when 'dc' then 'DC' when 'district of columbia' then 'DC'
    when 'fl' then 'FL' when 'florida' then 'FL'
    when 'ga' then 'GA' when 'georgia' then 'GA'
    when 'hi' then 'HI' when 'hawaii' then 'HI'
    when 'id' then 'ID' when 'idaho' then 'ID'
    when 'il' then 'IL' when 'illinois' then 'IL'
    when 'in' then 'IN' when 'indiana' then 'IN'
    when 'ia' then 'IA' when 'iowa' then 'IA'
    when 'ks' then 'KS' when 'kansas' then 'KS'
    when 'ky' then 'KY' when 'kentucky' then 'KY'
    when 'la' then 'LA' when 'louisiana' then 'LA'
    when 'me' then 'ME' when 'maine' then 'ME'
    when 'md' then 'MD' when 'maryland' then 'MD'
    when 'ma' then 'MA' when 'massachusetts' then 'MA'
    when 'mi' then 'MI' when 'michigan' then 'MI'
    when 'mn' then 'MN' when 'minnesota' then 'MN'
    when 'ms' then 'MS' when 'mississippi' then 'MS'
    when 'mo' then 'MO' when 'missouri' then 'MO'
    when 'mt' then 'MT' when 'montana' then 'MT'
    when 'ne' then 'NE' when 'nebraska' then 'NE'
    when 'nv' then 'NV' when 'nevada' then 'NV'
    when 'nh' then 'NH' when 'new hampshire' then 'NH'
    when 'nj' then 'NJ' when 'new jersey' then 'NJ'
    when 'nm' then 'NM' when 'new mexico' then 'NM'
    when 'ny' then 'NY' when 'new york' then 'NY'
    when 'nc' then 'NC' when 'north carolina' then 'NC'
    when 'nd' then 'ND' when 'north dakota' then 'ND'
    when 'oh' then 'OH' when 'ohio' then 'OH'
    when 'ok' then 'OK' when 'oklahoma' then 'OK'
    when 'or' then 'OR' when 'oregon' then 'OR'
    when 'pa' then 'PA' when 'pennsylvania' then 'PA'
    when 'ri' then 'RI' when 'rhode island' then 'RI'
    when 'sc' then 'SC' when 'south carolina' then 'SC'
    when 'sd' then 'SD' when 'south dakota' then 'SD'
    when 'tn' then 'TN' when 'tennessee' then 'TN'
    when 'tx' then 'TX' when 'texas' then 'TX'
    when 'ut' then 'UT' when 'utah' then 'UT'
    when 'vt' then 'VT' when 'vermont' then 'VT'
    when 'va' then 'VA' when 'virginia' then 'VA'
    when 'wa' then 'WA' when 'washington' then 'WA'
    when 'wv' then 'WV' when 'west virginia' then 'WV'
    when 'wi' then 'WI' when 'wisconsin' then 'WI'
    when 'wy' then 'WY' when 'wyoming' then 'WY'
    else upper(btrim(coalesce(value, '')))
  end
$$;

create or replace function public.contact_in_territory(p_state text, p_city text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.territories t
    where t.user_id = p_user
      and public.state_code(t.state) = public.state_code(p_state)
      and (
        btrim(t.area) = ''
        or lower(btrim(t.area)) = lower(btrim(coalesce(p_city, '')))
      )
  )
$$;

create or replace function public.can_log_visit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and (expires_at is null or expires_at >= current_date)
      and (role in ('admin', 'visitor', 'shliach') or can_edit)
  )
$$;

create or replace function public.can_see_household(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.households h
    join public.profiles p on p.id = auth.uid() and p.org_id = h.org_id
    where h.id = hid
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (
        (
          p.role = 'admin'
          and (
            h.shared_with_cora
            or h.owner_id is null
            or not exists (
              select 1 from public.profiles owner
              where owner.id = h.owner_id and owner.role = 'shliach'
            )
          )
        )
        or h.owner_id = p.id
        or (p.leader_id is not null and h.owner_id = p.leader_id)
        or exists (
          select 1 from public.profiles member
          where member.id = h.owner_id and member.leader_id = p.id
        )
        or (
          p.role = 'shliach'
          and h.shared_with_cora
          and public.contact_in_territory(h.state, h.city, coalesce(p.leader_id, p.id))
        )
        or (
          p.role = 'limited'
          and exists (
            select 1
            from public.route_stops rs
            join public.route_assignments ra on ra.route_id = rs.route_id
            where rs.household_id = h.id and ra.user_id = p.id
          )
        )
      )
  )
$$;

create or replace function public.can_edit_household(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.households h
    join public.profiles p on p.id = auth.uid() and p.org_id = h.org_id
    where h.id = hid
      and p.status = 'approved'
      and (p.expires_at is null or p.expires_at >= current_date)
      and (p.role = 'admin' or p.can_edit or p.role = 'shliach')
      and (
        p.role = 'admin'
        or h.owner_id = p.id
        or (p.leader_id is not null and h.owner_id = p.leader_id)
        or exists (
          select 1 from public.profiles member
          where member.id = h.owner_id and member.leader_id = p.id
        )
      )
  )
$$;

create or replace function public.can_see_route(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.routes r
    join public.profiles p on p.id = auth.uid() and p.org_id = r.org_id
    where r.id = rid
      and p.status = 'approved'
      and (
        p.role in ('admin', 'visitor', 'shliach')
        or exists (
          select 1 from public.route_assignments ra
          where ra.route_id = r.id and ra.user_id = p.id
        )
      )
  )
$$;

create or replace function public.enforce_household_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  book uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.status <> 'approved' then
    raise exception 'You cannot edit contacts yet';
  end if;

  if actor.role = 'admin' then
    if new.owner_id is null then
      new.owner_id := actor.id;
    end if;
    if exists (
      select 1 from public.profiles owner
      where owner.id = new.owner_id and owner.role = 'shliach'
    ) and not public.contact_in_territory(new.state, new.city, new.owner_id) then
      raise exception 'That contact is outside the shliach territory';
    end if;
    return new;
  end if;

  book := coalesce(actor.leader_id, actor.id);
  new.owner_id := book;
  if not public.contact_in_territory(new.state, new.city, book) then
    raise exception 'That contact is outside your territory';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_household_access on public.households;
create trigger enforce_household_access
  before insert or update on public.households
  for each row execute function public.enforce_household_access();

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
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
  return new;
end;
$$;

drop policy if exists households_select on public.households;
drop policy if exists households_insert on public.households;
drop policy if exists households_update on public.households;
drop policy if exists households_delete on public.households;
create policy households_select on public.households for select to authenticated
  using (public.can_see_household(id));
create policy households_insert on public.households for insert to authenticated
  with check (org_id = public.my_org_id() and public.can_edit_database());
create policy households_update on public.households for update to authenticated
  using (public.can_edit_household(id) and public.can_see_household(id))
  with check (org_id = public.my_org_id() and public.can_edit_database());
create policy households_delete on public.households for delete to authenticated
  using (public.can_edit_household(id) and public.can_see_household(id));

drop policy if exists people_write on public.people;
drop policy if exists people_select on public.people;
drop policy if exists people_insert on public.people;
drop policy if exists people_update on public.people;
drop policy if exists people_delete on public.people;
create policy people_select on public.people for select to authenticated
  using (public.can_see_household(household_id));
create policy people_insert on public.people for insert to authenticated
  with check (public.can_edit_household(household_id));
create policy people_update on public.people for update to authenticated
  using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));
create policy people_delete on public.people for delete to authenticated
  using (public.can_edit_household(household_id));

drop policy if exists hc_write on public.household_categories;
create policy hc_write on public.household_categories for all to authenticated
  using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists routes_insert on public.routes;
drop policy if exists routes_update on public.routes;
create policy routes_insert on public.routes for insert to authenticated
  with check (org_id = public.my_org_id() and public.access_open() and public.my_role() in ('admin', 'visitor', 'shliach'));
create policy routes_update on public.routes for update to authenticated
  using (public.can_see_route(id) and public.access_open() and public.my_role() in ('admin', 'visitor', 'shliach'))
  with check (org_id = public.my_org_id());

drop policy if exists stops_write on public.route_stops;
create policy stops_write on public.route_stops for all to authenticated
  using (public.can_see_route(route_id) and public.access_open() and public.my_role() in ('admin', 'visitor', 'shliach'))
  with check (public.can_see_route(route_id) and public.my_role() in ('admin', 'visitor', 'shliach'));

drop policy if exists territories_select on public.territories;
drop policy if exists territories_write on public.territories;
create policy territories_select on public.territories for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or user_id = (select leader_id from public.profiles where id = auth.uid())
  );
create policy territories_write on public.territories for all to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and exists (
      select 1 from public.profiles owner
      where owner.id = user_id and owner.org_id = public.my_org_id()
    )
  );

grant select, insert, update, delete on public.territories to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.can_log_visit() to authenticated;
grant execute on function public.can_see_household(uuid) to authenticated;
grant execute on function public.can_edit_household(uuid) to authenticated;
grant execute on function public.can_see_route(uuid) to authenticated;
grant execute on function public.contact_in_territory(text, text, uuid) to authenticated;
grant execute on function public.state_code(text) to authenticated;

revoke all on function public.enforce_household_access() from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
