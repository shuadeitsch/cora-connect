
create or replace function public.visit_default_visited_by(
  p_household_id uuid,
  p_project_id uuid,
  p_logger uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  h_state text;
  logger_name text;
  logger_is_bochur boolean := false;
  names text[];
  result text;
begin
  select h.state into h_state
  from public.households h
  where h.id = p_household_id;

  select p.name, public.role_is_bochur(p.role)
  into logger_name, logger_is_bochur
  from public.profiles p
  where p.id = p_logger;

  select coalesce(array_agg(x.name order by x.name), array[]::text[])
  into names
  from (
    select distinct b.id, b.name
    from public.profiles b
    join public.profiles s on s.id = b.leader_id
    where public.role_is_bochur(b.role)
      and b.status = 'approved'
      and (b.expires_at is null or b.expires_at >= current_date)
      and s.role = 'shliach'
      and s.status = 'approved'
      and (s.expires_at is null or s.expires_at >= current_date)
      and exists (
        select 1
        from public.territories t
        where t.user_id = s.id
          and public.state_code(t.state) = public.state_code(h_state)
      )
      and (
        b.project_id is null
        or p_project_id is null
        or b.project_id = p_project_id
      )
  ) x;

  if logger_is_bochur and logger_name is not null and btrim(logger_name) <> '' then
    if not (logger_name = any (names)) then
      names := array_append(names, logger_name);
      names := (select array_agg(n order by n) from unnest(names) as n);
    end if;
  end if;

  if names is null or cardinality(names) = 0 then
    return nullif(btrim(coalesce(logger_name, '')), '');
  end if;

  if cardinality(names) = 1 then
    result := names[1];
  elsif cardinality(names) = 2 then
    result := names[1] || ' & ' || names[2];
  else
    result := array_to_string(names, ', ');
  end if;

  return result;
end;
$fn$;


create or replace function public.contact_visits_set_visited_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.visited_by is null or btrim(new.visited_by) = '' then
    new.visited_by := public.visit_default_visited_by(
      new.household_id,
      new.project_id,
      coalesce(new.created_by, auth.uid())
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists contact_visits_set_visited_by on public.contact_visits;
create trigger contact_visits_set_visited_by
  before insert on public.contact_visits
  for each row
  execute function public.contact_visits_set_visited_by();

revoke all on function public.visit_default_visited_by(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.contact_visits_set_visited_by() from public, anon, authenticated;

comment on function public.visit_default_visited_by(uuid, uuid, uuid) is
  'Snapshot text for visited_by: bochurim of the state shliach (project-matched), else logger name.';
