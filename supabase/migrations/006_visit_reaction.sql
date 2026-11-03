-- Household reaction from the visit. Run after 005_shliach_access.sql.
-- Safe to run again. Does not edit earlier migrations.
-- Cora admins are not territory-scoped. This column is only the visit reaction.
--
-- A Cora admin created straight into auth.users (profile filled by
-- zz_apply_preapproved_admin) stays an admin of the Cora org, with no
-- leader and no territory rows. The app reads profiles.role, not
-- auth user_metadata. Missing territory is correct for an admin.

-- The privilege trigger blocks a SQL-editor update, so lift it for this repair.
alter table public.profiles disable trigger protect_profile_privileges;

update public.profiles
set
  org_id = 'c0a00000-0000-4000-8000-000000000001',
  role = 'admin',
  status = 'approved',
  expires_at = null,
  can_view_history = true,
  can_view_contact = true,
  can_edit = true,
  leader_id = null
where lower(email) in (
  select lower(email) from public.preapproved_admins
);

alter table public.profiles enable trigger protect_profile_privileges;

delete from public.territories t
using public.profiles p
where t.user_id = p.id
  and p.role = 'admin';

alter table public.households
  add column if not exists visit_reaction text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'households_visit_reaction_check'
  ) then
    alter table public.households
      add constraint households_visit_reaction_check
      check (
        visit_reaction is null
        or visit_reaction in ('very_happy', 'warm', 'neutral', 'cold', 'very_cold')
      );
  end if;
end $$;
