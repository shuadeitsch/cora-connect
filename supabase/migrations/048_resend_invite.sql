-- 1.8.63: stamp when an invite is (re)sent, and let an admin correct the login
-- email of someone who has not signed in yet.
alter table public.invites
  add column if not exists last_invited_at timestamptz;

alter table public.profiles
  add column if not exists last_invited_at timestamptz;

comment on column public.invites.last_invited_at is
  'Set when an admin sends or resends the invite email. change_log records the update.';

comment on column public.profiles.last_invited_at is
  'Set when an admin resends the invite email to a login that has not signed in yet.';

create or replace function public.pending_login_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'auth', 'public'
as $$
  select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
   where public.is_admin()
     and p.org_id = public.my_org_id()
     and u.last_sign_in_at is null
$$;

revoke all on function public.pending_login_user_ids() from public, anon;
grant execute on function public.pending_login_user_ids() to authenticated;

create or replace function public.admin_update_pending_login_email(target_id uuid, new_email text)
returns boolean
language plpgsql
security definer
set search_path to 'auth', 'public'
as $$
declare
  clean text := lower(trim(new_email));
  signed_in timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can change a pending login email.' using errcode = '42501';
  end if;
  if target_id is null or clean is null or position('@' in clean) < 2 then
    raise exception 'Enter a valid email.' using errcode = '22023';
  end if;

  select u.last_sign_in_at into signed_in
    from auth.users u
   where u.id = target_id;

  if not found then
    return false;
  end if;
  if signed_in is not null then
    raise exception 'That person has already signed in. The login email was not changed.' using errcode = '42501';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = clean and u.id <> target_id) then
    raise exception 'That email already has a login.' using errcode = '23505';
  end if;

  update auth.users
     set email = clean,
         email_change = '',
         email_change_token_new = '',
         email_change_token_current = '',
         updated_at = now()
   where id = target_id
     and last_sign_in_at is null;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', clean),
         provider_id = case when provider = 'email' then clean else provider_id end,
         updated_at = now()
   where user_id = target_id
     and provider = 'email';

  update public.profiles
     set email = clean
   where id = target_id
     and lower(email) is distinct from clean;

  return true;
end;
$$;

revoke all on function public.admin_update_pending_login_email(uuid, text) from public, anon;
grant execute on function public.admin_update_pending_login_email(uuid, text) to authenticated;
