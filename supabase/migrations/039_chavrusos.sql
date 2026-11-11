-- 1.8.45: Chavrusos A/B. Additive only.
-- Existing planner_days stay shared (chavrusa is null). No updates to Mendel's real days.
-- RULE: never subquery a table inside its own RLS policy; use security-definer helpers.

alter table public.profiles
  add column if not exists chavrusa text;

alter table public.profiles
  drop constraint if exists profiles_chavrusa_check;
alter table public.profiles
  add constraint profiles_chavrusa_check
  check (chavrusa is null or chavrusa in ('A', 'B'));

alter table public.planner_days
  add column if not exists chavrusa text;

alter table public.planner_days
  drop constraint if exists planner_days_chavrusa_check;
alter table public.planner_days
  add constraint planner_days_chavrusa_check
  check (chavrusa is null or chavrusa in ('A', 'B'));

-- Widen the unique key so Shared, A, and B can each have the same date.
-- coalesce(chavrusa, '') treats null (shared) as its own slot; Postgres unique
-- would otherwise allow multiple shared rows on one date.
alter table public.planner_days
  drop constraint if exists planner_days_org_id_date_key;

drop index if exists public.planner_days_org_date_chavrusa_uidx;
create unique index planner_days_org_date_chavrusa_uidx
  on public.planner_days (org_id, date, (coalesce(chavrusa, '')));

create or replace function public.my_chavrusa()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.chavrusa
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke all on function public.my_chavrusa() from public, anon;
grant execute on function public.my_chavrusa() to authenticated;

create or replace function public.set_bochur_chavrusa(p_bochur uuid, p_chavrusa text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chavrusa text;
  v_ok boolean := false;
begin
  v_chavrusa := nullif(btrim(coalesce(p_chavrusa, '')), '');
  if v_chavrusa is not null and v_chavrusa not in ('A', 'B') then
    raise exception 'Chavrusa must be A, B, or empty.';
  end if;

  if public.is_admin() then
    select true into v_ok
    from public.profiles b
    where b.id = p_bochur
      and b.org_id = public.my_org_id()
      and public.role_is_bochur(b.role);
  elsif public.my_role() = 'shliach' then
    select true into v_ok
    from public.profiles b
    where b.id = p_bochur
      and b.org_id = public.my_org_id()
      and public.role_is_bochur(b.role)
      and b.leader_id = auth.uid();
  end if;

  if v_ok is not true then
    raise exception 'You can only assign chavrusos for your own bochurim.';
  end if;

  perform set_config('cora.allow_chavrusa', '1', true);
  update public.profiles
  set chavrusa = v_chavrusa
  where id = p_bochur;
  perform set_config('cora.allow_chavrusa', '', true);

  return v_chavrusa;
end;
$$;

revoke all on function public.set_bochur_chavrusa(uuid, text) from public, anon;
grant execute on function public.set_bochur_chavrusa(uuid, text) to authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_chavrusa text;
begin
  -- RPC-only path: apply chavrusa and leave every other column alone
  -- (avoids approval / expiry side effects on a chavrusa assignment).
  if current_setting('cora.allow_chavrusa', true) = '1' then
    v_chavrusa := new.chavrusa;
    new := old;
    new.chavrusa := v_chavrusa;
    return new;
  end if;
  new.chavrusa := old.chavrusa;

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

create or replace function public.protect_planner_day_chavrusa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_is_bochur(public.my_role()) then
    if tg_op = 'INSERT' then
      if new.chavrusa is not null and new.chavrusa is distinct from public.my_chavrusa() then
        raise exception 'You can only add days for your chavrusa.';
      end if;
    elsif new.chavrusa is distinct from old.chavrusa then
      raise exception 'You cannot change which chavrusa a day belongs to.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_planner_day_chavrusa on public.planner_days;
create trigger protect_planner_day_chavrusa
  before insert or update on public.planner_days
  for each row execute function public.protect_planner_day_chavrusa();

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
        or (
          d.visible_to_bochurim
          and (d.chavrusa is null or d.chavrusa = public.my_chavrusa())
        )
      )
  )
$$;

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
          and (d.chavrusa is null or d.chavrusa = public.my_chavrusa())
        )
      )
  )
$$;

drop policy if exists planner_days_select on public.planner_days;
create policy planner_days_select on public.planner_days for select to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      not public.role_is_bochur(public.my_role())
      or (
        visible_to_bochurim
        and (chavrusa is null or chavrusa = public.my_chavrusa())
      )
    )
  );

-- FOR ALL write policies also apply to SELECT and would leak hidden-but-editable
-- days (and items) to bochurim. Restrict writes to INSERT/UPDATE/DELETE only.
drop policy if exists planner_days_write on public.planner_days;
drop policy if exists planner_days_insert on public.planner_days;
drop policy if exists planner_days_update on public.planner_days;
drop policy if exists planner_days_delete on public.planner_days;

create policy planner_days_insert on public.planner_days for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (
        public.role_is_bochur(public.my_role())
        and editable_by_bochurim
        and (chavrusa is null or chavrusa = public.my_chavrusa())
      )
    )
  );

create policy planner_days_update on public.planner_days for update to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (
        public.role_is_bochur(public.my_role())
        and editable_by_bochurim
        and (chavrusa is null or chavrusa = public.my_chavrusa())
      )
    )
  )
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (
        public.role_is_bochur(public.my_role())
        and editable_by_bochurim
        and (chavrusa is null or chavrusa = public.my_chavrusa())
      )
    )
  );

create policy planner_days_delete on public.planner_days for delete to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (
      public.is_admin()
      or public.my_role() = 'shliach'
      or (
        public.role_is_bochur(public.my_role())
        and editable_by_bochurim
        and (chavrusa is null or chavrusa = public.my_chavrusa())
      )
    )
  );

drop policy if exists planner_items_write on public.planner_items;
drop policy if exists planner_items_insert on public.planner_items;
drop policy if exists planner_items_update on public.planner_items;
drop policy if exists planner_items_delete on public.planner_items;

create policy planner_items_insert on public.planner_items for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and public.planner_day_editable_by_me(day_id)
  );

create policy planner_items_update on public.planner_items for update to authenticated
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

create policy planner_items_delete on public.planner_items for delete to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and public.planner_day_editable_by_me(day_id)
  );
