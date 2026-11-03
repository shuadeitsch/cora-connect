-- Contact save. Run after 006_visit_reaction.sql.
-- Safe to run again. Does not edit earlier migrations.
--
-- INSERT ... RETURNING was failing with
-- "new row violates row-level security policy for table households"
-- because households_select called can_see_household(id), and that
-- lookup cannot see the row being inserted. Policies now read the
-- row they are judging. A blank state is not outside a territory;
-- a shliach's blank state is filled from their first territory when
-- they have one.

create or replace function public.can_see_household_row(h public.households)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = h.org_id
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

create or replace function public.can_edit_household_row(h public.households)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = h.org_id
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

create or replace function public.territory_state(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.state
  from public.territories t
  where t.user_id = p_user
    and btrim(coalesce(t.state, '')) <> ''
  order by (btrim(coalesce(t.area, '')) = '') desc, t.state
  limit 1
$$;

create or replace function public.state_in_territory(p_state text, p_city text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.contact_in_territory(p_state, p_city, p_user)
    or (
      btrim(coalesce(p_city, '')) = ''
      and exists (
        select 1
        from public.territories t
        where t.user_id = p_user
          and public.state_code(t.state) = public.state_code(p_state)
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
  new.owner_id := book;
  if btrim(coalesce(new.state, '')) = '' then
    new.state := coalesce(public.territory_state(book), '');
  end if;
  if btrim(coalesce(new.state, '')) <> ''
     and not public.state_in_territory(new.state, new.city, book) then
    raise exception 'That contact is outside your territory';
  end if;
  return new;
end;
$$;

drop policy if exists households_select on public.households;
drop policy if exists households_update on public.households;
drop policy if exists households_delete on public.households;
create policy households_select on public.households for select to authenticated
  using (public.can_see_household_row(households));
create policy households_update on public.households for update to authenticated
  using (public.can_edit_household_row(households) and public.can_see_household_row(households))
  with check (public.can_edit_household_row(households));
create policy households_delete on public.households for delete to authenticated
  using (public.can_edit_household_row(households) and public.can_see_household_row(households));

revoke all on function public.can_see_household_row(public.households) from public, anon;
revoke all on function public.can_edit_household_row(public.households) from public, anon;
revoke all on function public.territory_state(uuid) from public, anon;
revoke all on function public.state_in_territory(text, text, uuid) from public, anon;
grant execute on function public.can_see_household_row(public.households) to authenticated;
grant execute on function public.can_edit_household_row(public.households) to authenticated;
grant execute on function public.territory_state(uuid) to authenticated;
grant execute on function public.state_in_territory(text, text, uuid) to authenticated;
revoke all on function public.enforce_household_access() from public, anon, authenticated;
