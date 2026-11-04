-- 1.8.1: "Not a duplicate".
-- Records pairs of contacts someone confirmed are NOT the same, so imports and
-- the possible-duplicate matching skip them. Pair stored once, low id first.
-- Who may mark: admins, plus anyone allowed to edit the contact; a shliach only
-- on contacts he owns; bochurim never.

create or replace function public.can_mark_not_duplicate(hid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.can_edit_household(hid) and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p join public.households h on h.id = hid
      where p.id = auth.uid()
        and not public.role_is_bochur(p.role)
        and (p.role <> 'shliach' or h.owner_id = p.id)
    )
  )
$$;

create table if not exists public.not_duplicate_pairs (
  a_id uuid not null references public.households(id) on delete cascade,
  b_id uuid not null references public.households(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (a_id, b_id),
  check (a_id < b_id)
);
create index if not exists not_duplicate_pairs_b_idx on public.not_duplicate_pairs (b_id);
alter table public.not_duplicate_pairs enable row level security;

drop policy if exists not_duplicate_pairs_select on public.not_duplicate_pairs;
create policy not_duplicate_pairs_select on public.not_duplicate_pairs for select to authenticated
  using (public.can_see_household(a_id) or public.can_see_household(b_id));
drop policy if exists not_duplicate_pairs_insert on public.not_duplicate_pairs;
create policy not_duplicate_pairs_insert on public.not_duplicate_pairs for insert to authenticated
  with check (created_by = auth.uid() and (public.can_mark_not_duplicate(a_id) or public.can_mark_not_duplicate(b_id)));
drop policy if exists not_duplicate_pairs_delete on public.not_duplicate_pairs;
create policy not_duplicate_pairs_delete on public.not_duplicate_pairs for delete to authenticated
  using (public.can_mark_not_duplicate(a_id) or public.can_mark_not_duplicate(b_id));

-- Clearing or changing the duplicate flags on an existing contact follows the same rule.
create or replace function public.guard_duplicate_flags()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null
     and (new.possible_duplicate is distinct from old.possible_duplicate or new.duplicate_of is distinct from old.duplicate_of)
     and new.deleted_at is not distinct from old.deleted_at
     and not public.can_mark_not_duplicate(old.id) then
    raise exception 'You can''t change the duplicate flag on this contact.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_duplicate_flags on public.households;
create trigger guard_duplicate_flags before update of possible_duplicate, duplicate_of on public.households
  for each row execute function public.guard_duplicate_flags();
