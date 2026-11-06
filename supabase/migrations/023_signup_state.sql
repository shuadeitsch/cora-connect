-- Shliach signup requires a state (ME / NH / WI). Stored on the profile via territories.
-- sync_profile_from_auth reads raw_user_meta_data.state (state code) and inserts a territory
-- when the new profile is a shliach (from invite) or when metadata includes a state.
-- RLS already scopes shluchim by territories (contact_in_territory).

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  oid uuid;
  pname text;
  v_history boolean;
  v_contact boolean;
  v_edit boolean;
  meta_state text;
begin
  if new.email is null then
    return new;
  end if;
  if tg_op = 'INSERT' and coalesce(new.raw_app_meta_data->>'seed', '') = 'true' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    return new;
  end if;

  pname := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  meta_state := public.state_code(nullif(btrim(coalesce(new.raw_user_meta_data->>'state', '')), ''));

  select * into inv from public.invites
  where lower(email) = lower(new.email) and accepted_at is null
  order by created_at desc
  limit 1;

  if inv.id is not null then
    if inv.role = 'shliach' and coalesce(cardinality(inv.territory_states), 0) = 0 and meta_state is null then
      raise exception 'Shliach invite for % needs at least one state', new.email using errcode = 'P0001';
    end if;

    if inv.role in ('admin', 'shliach') then
      v_history := true;
      v_contact := true;
      v_edit := true;
    else
      v_history := inv.can_view_history;
      v_contact := inv.can_view_contact;
      v_edit := inv.can_edit;
    end if;

    insert into public.profiles (
      id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit
    ) values (
      new.id,
      inv.org_id,
      coalesce(nullif(inv.name, ''), pname),
      lower(new.email),
      inv.role,
      'approved',
      inv.expires_at,
      v_history,
      v_contact,
      v_edit
    );

    if inv.role = 'shliach' then
      if coalesce(cardinality(inv.territory_states), 0) > 0 then
        if coalesce(cardinality(inv.territory_areas), 0) = 0 then
          insert into public.territories (user_id, state, area)
          select new.id, public.state_code(s), ''
          from unnest(inv.territory_states) as s
          on conflict do nothing;
        else
          insert into public.territories (user_id, state, area)
          select new.id, public.state_code(s), btrim(a)
          from unnest(inv.territory_states) as s
          cross join unnest(inv.territory_areas) as a
          where btrim(coalesce(a, '')) <> ''
          on conflict do nothing;
        end if;
      elsif meta_state is not null then
        insert into public.territories (user_id, state, area)
        values (new.id, meta_state, '')
        on conflict do nothing;
      end if;
    elsif meta_state is not null then
      insert into public.territories (user_id, state, area)
      values (new.id, meta_state, '')
      on conflict do nothing;
    end if;

    insert into public.route_assignments (route_id, user_id)
    select r.id, new.id
    from unnest(inv.assigned_route_ids) as rid
    join public.routes r on r.id = rid
    on conflict do nothing;

    update public.invites set accepted_at = now() where id = inv.id;
    return new;
  end if;

  if public.is_allowlisted_admin(new.email) then
    oid := public.ensure_org();
    insert into public.profiles (
      id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit
    ) values (
      new.id, oid, pname, lower(new.email), 'visitor', 'pending', null, false, false, false
    )
    on conflict (id) do update set
      email = excluded.email;
    if meta_state is not null then
      insert into public.territories (user_id, state, area)
      values (new.id, meta_state, '')
      on conflict do nothing;
    end if;
    return new;
  end if;

  raise exception 'No invitation was found for %', new.email using errcode = 'P0001';
end;
$$;

revoke all on function public.sync_profile_from_auth() from public, anon, authenticated;
