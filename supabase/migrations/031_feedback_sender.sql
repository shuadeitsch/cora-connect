-- 1.8.25: admin Feedback shows sender email via a security-definer view (no self-ref RLS on feedback).
-- user_id already exists; ensure it defaults to auth.uid() for new rows.

alter table public.feedback
  alter column user_id set default auth.uid();

-- Allow older/legacy rows without a resolved sender.
alter table public.feedback
  alter column user_id drop not null;

create or replace view public.feedback_for_admin
with (security_invoker = false)
as
select
  f.id,
  f.user_id,
  coalesce(nullif(trim(f.name), ''), nullif(trim(p.name), ''), 'Unknown') as name,
  coalesce(nullif(trim(f.role), ''), p.role::text, '') as role,
  coalesce(nullif(trim(f.state), ''), (
    select t.state from public.territories t where t.user_id = f.user_id order by t.state limit 1
  ), '') as state,
  coalesce(nullif(trim(p.email), ''), '') as email,
  f.message,
  f.page,
  f.created_at,
  f.read_at,
  f.archived_at
from public.feedback f
left join public.profiles p on p.id = f.user_id;

-- View is security_definer-style via security_invoker=false (owner rights).
-- Restrict who can select: revoke public, grant authenticated; RLS on base table still
-- applies when security_invoker=true, so we keep invoker=false and gate in the app + grant.
revoke all on public.feedback_for_admin from public;
grant select on public.feedback_for_admin to authenticated;

-- Helper so only admins get rows even through the view owner path.
create or replace function public.feedback_admin_rows()
returns setof public.feedback_for_admin
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.feedback_for_admin f
  where public.is_admin()
    and f.archived_at is null
  order by f.created_at desc
  limit 100;
$$;

grant execute on function public.feedback_admin_rows() to authenticated;
