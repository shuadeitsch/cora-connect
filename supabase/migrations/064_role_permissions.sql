-- Admin-editable on/off switches per role (shliach, bochur). No row = keep today's behavior (allowed).
create table if not exists public.role_permissions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('shliach', 'bochur')),
  permission text not null,
  enabled boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, role, permission)
);

alter table public.role_permissions enable row level security;
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select to authenticated using (org_id = public.my_org_id());
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions
  for all to authenticated
  using (public.is_admin() and org_id = public.my_org_id())
  with check (public.is_admin() and org_id = public.my_org_id());
revoke all on public.role_permissions from anon;

-- Does the signed-in user's role allow this permission? Admins always; no row = allowed.
create or replace function public.role_allows(p_permission text)
returns boolean language sql stable security definer set search_path = public
as $function$
  select case
    when p.id is null then false
    when p.role::text = 'admin' then true
    else coalesce((
      select rp.enabled from public.role_permissions rp
      where rp.org_id = p.org_id
        and rp.role = case when public.role_is_bochur(p.role) then 'bochur' else p.role::text end
        and rp.permission = p_permission
    ), true)
  end
  from (select 1) one left join public.profiles p on p.id = auth.uid();
$function$;
revoke all on function public.role_allows(text) from public, anon;
grant execute on function public.role_allows(text) to authenticated;

-- Restrictive policies are ANDed with the existing ones, so nothing else has to change.
drop policy if exists rp_preplanner on public.preplanner_entries;
create policy rp_preplanner on public.preplanner_entries as restrictive for all to authenticated
  using (public.role_allows('preplanner')) with check (public.role_allows('preplanner'));

drop policy if exists rp_planner_days_ins on public.planner_days;
create policy rp_planner_days_ins on public.planner_days as restrictive for insert to authenticated with check (public.role_allows('edit_planner'));
drop policy if exists rp_planner_days_upd on public.planner_days;
create policy rp_planner_days_upd on public.planner_days as restrictive for update to authenticated using (public.role_allows('edit_planner')) with check (public.role_allows('edit_planner'));
drop policy if exists rp_planner_days_del on public.planner_days;
create policy rp_planner_days_del on public.planner_days as restrictive for delete to authenticated using (public.role_allows('edit_planner'));
drop policy if exists rp_planner_days_sel on public.planner_days;
create policy rp_planner_days_sel on public.planner_days as restrictive for select to authenticated using (public.role_allows('see_planner'));

drop policy if exists rp_planner_items_ins on public.planner_items;
create policy rp_planner_items_ins on public.planner_items as restrictive for insert to authenticated with check (public.role_allows('edit_planner'));
drop policy if exists rp_planner_items_upd on public.planner_items;
create policy rp_planner_items_upd on public.planner_items as restrictive for update to authenticated using (public.role_allows('edit_planner')) with check (public.role_allows('edit_planner'));
drop policy if exists rp_planner_items_del on public.planner_items;
create policy rp_planner_items_del on public.planner_items as restrictive for delete to authenticated using (public.role_allows('edit_planner'));
drop policy if exists rp_planner_items_sel on public.planner_items;
create policy rp_planner_items_sel on public.planner_items as restrictive for select to authenticated using (public.role_allows('see_planner'));

drop policy if exists rp_routes_ins on public.routes;
create policy rp_routes_ins on public.routes as restrictive for insert to authenticated with check (public.role_allows('edit_routes'));
drop policy if exists rp_routes_upd on public.routes;
create policy rp_routes_upd on public.routes as restrictive for update to authenticated using (public.role_allows('edit_routes')) with check (public.role_allows('edit_routes'));
drop policy if exists rp_stops_ins on public.route_stops;
create policy rp_stops_ins on public.route_stops as restrictive for insert to authenticated with check (public.role_allows('edit_routes'));
drop policy if exists rp_stops_upd on public.route_stops;
create policy rp_stops_upd on public.route_stops as restrictive for update to authenticated using (public.role_allows('edit_routes')) with check (public.role_allows('edit_routes'));
drop policy if exists rp_stops_del on public.route_stops;
create policy rp_stops_del on public.route_stops as restrictive for delete to authenticated using (public.role_allows('edit_routes'));

drop policy if exists rp_contact_visits_ins on public.contact_visits;
create policy rp_contact_visits_ins on public.contact_visits as restrictive for insert to authenticated with check (public.role_allows('log_visits'));
drop policy if exists rp_contact_visits_upd on public.contact_visits;
create policy rp_contact_visits_upd on public.contact_visits as restrictive for update to authenticated using (public.role_allows('log_visits')) with check (public.role_allows('log_visits'));
drop policy if exists rp_visits_ins on public.visits;
create policy rp_visits_ins on public.visits as restrictive for insert to authenticated with check (public.role_allows('log_visits'));
drop policy if exists rp_visits_upd on public.visits;
create policy rp_visits_upd on public.visits as restrictive for update to authenticated using (public.role_allows('log_visits')) with check (public.role_allows('log_visits'));
