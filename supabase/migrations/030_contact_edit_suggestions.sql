-- 1.8.25: bochur suggested contact edits (pending / approved / rejected).

create table if not exists public.contact_edit_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  bochur_id uuid not null references public.profiles(id) on delete cascade,
  changes jsonb not null default '[]'::jsonb,
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists contact_edit_suggestions_pending_idx
  on public.contact_edit_suggestions (org_id, status, created_at desc);
create index if not exists contact_edit_suggestions_household_idx
  on public.contact_edit_suggestions (household_id);
create index if not exists contact_edit_suggestions_bochur_idx
  on public.contact_edit_suggestions (bochur_id);

alter table public.contact_edit_suggestions enable row level security;

create or replace function public.can_see_contact_edit_suggestion(p_org uuid, p_bochur uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.org_id = p_org
      and me.status = 'approved'
      and (me.expires_at is null or me.expires_at >= current_date)
      and (
        me.role = 'admin'
        or me.id = p_bochur
        or (me.role = 'shliach' and public.leads_bochur(p_bochur))
      )
  )
$$;

create or replace function public.can_insert_contact_edit_suggestion(p_org uuid, p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.org_id = p_org
      and me.status = 'approved'
      and (me.expires_at is null or me.expires_at >= current_date)
      and public.role_is_bochur(me.role)
      and public.can_see_household(p_household)
  )
$$;

create or replace function public.can_review_contact_edit_suggestion(p_org uuid, p_bochur uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.org_id = p_org
      and me.status = 'approved'
      and (me.expires_at is null or me.expires_at >= current_date)
      and (
        me.role = 'admin'
        or (me.role = 'shliach' and public.leads_bochur(p_bochur))
      )
  )
$$;

drop policy if exists contact_edit_suggestions_select on public.contact_edit_suggestions;
create policy contact_edit_suggestions_select on public.contact_edit_suggestions
  for select to authenticated
  using (public.can_see_contact_edit_suggestion(org_id, bochur_id));

drop policy if exists contact_edit_suggestions_insert on public.contact_edit_suggestions;
create policy contact_edit_suggestions_insert on public.contact_edit_suggestions
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and bochur_id = auth.uid()
    and status = 'pending'
    and public.can_insert_contact_edit_suggestion(org_id, household_id)
  );

-- Reviewers update status / reviewed_*; bochur never updates.
drop policy if exists contact_edit_suggestions_update on public.contact_edit_suggestions;
create policy contact_edit_suggestions_update on public.contact_edit_suggestions
  for update to authenticated
  using (public.can_review_contact_edit_suggestion(org_id, bochur_id))
  with check (public.can_review_contact_edit_suggestion(org_id, bochur_id));

drop policy if exists contact_edit_suggestions_delete on public.contact_edit_suggestions;
create policy contact_edit_suggestions_delete on public.contact_edit_suggestions
  for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.contact_edit_suggestions to authenticated;

-- Apply approved field changes onto the household. Only callable by a reviewer.
create or replace function public.apply_contact_edit_suggestion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sug public.contact_edit_suggestions%rowtype;
  change jsonb;
  field text;
  new_val text;
begin
  select * into sug from public.contact_edit_suggestions where id = p_id for update;
  if not found then
    raise exception 'Suggestion not found';
  end if;
  if sug.status <> 'pending' then
    raise exception 'Suggestion already reviewed';
  end if;
  if not public.can_review_contact_edit_suggestion(sug.org_id, sug.bochur_id) then
    raise exception 'Not allowed to review this suggestion';
  end if;

  for change in select * from jsonb_array_elements(coalesce(sug.changes, '[]'::jsonb))
  loop
    field := change->>'field';
    new_val := change->>'new';
    if field = 'name' then
      update public.households set name = coalesce(new_val, name) where id = sug.household_id;
    elsif field = 'street' then
      update public.households set street = coalesce(new_val, street) where id = sug.household_id;
    elsif field = 'city' then
      update public.households set city = coalesce(new_val, city) where id = sug.household_id;
    elsif field = 'state' then
      update public.households set state = coalesce(new_val, state) where id = sug.household_id;
    elsif field = 'zip' then
      update public.households set zip = coalesce(new_val, zip) where id = sug.household_id;
    elsif field = 'country' then
      update public.households set country = coalesce(new_val, country) where id = sug.household_id;
    elsif field = 'notes' then
      update public.households set notes = coalesce(new_val, notes) where id = sug.household_id;
    end if;
  end loop;

  update public.contact_edit_suggestions
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
end;
$$;

create or replace function public.reject_contact_edit_suggestion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sug public.contact_edit_suggestions%rowtype;
begin
  select * into sug from public.contact_edit_suggestions where id = p_id for update;
  if not found then
    raise exception 'Suggestion not found';
  end if;
  if sug.status <> 'pending' then
    raise exception 'Suggestion already reviewed';
  end if;
  if not public.can_review_contact_edit_suggestion(sug.org_id, sug.bochur_id) then
    raise exception 'Not allowed to review this suggestion';
  end if;
  update public.contact_edit_suggestions
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.apply_contact_edit_suggestion(uuid) to authenticated;
grant execute on function public.reject_contact_edit_suggestion(uuid) to authenticated;
