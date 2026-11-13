-- 1.8.62: real CRM email sending (Gmail API + domain/Resend), per-person opt-out, and per-send logging.

alter table public.people
  add column if not exists email_opt_out boolean not null default false;

comment on column public.people.email_opt_out is
  'True when this person has opted out of outreach email. Domain and Gmail sends skip them.';

create or replace view public.people_visible
with (security_invoker = false) as
select
  pe.id,
  pe.household_id,
  pe.name,
  pe.gender,
  pe.sort_order,
  case when public.can_view_contact() then pe.phone else '' end as phone,
  case when public.can_view_contact() then pe.email else '' end as email,
  case when public.can_view_contact() then pe.whatsapp else '' end as whatsapp,
  case when public.can_view_contact() then coalesce(pe.phone2, '') else '' end as phone2,
  case when public.can_view_contact() then coalesce(pe.phone3, '') else '' end as phone3,
  pe.email_opt_out
from public.people pe
where public.can_see_household(pe.household_id);

grant select on public.people_visible to authenticated;

-- Per-user connected Gmail accounts. Refresh tokens are stored encrypted and
-- are not selectable by the authenticated role; server functions read them.
create table if not exists public.outreach_gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  refresh_token_cipher text not null,
  refresh_token_iv text not null,
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint outreach_gmail_email_check check (position('@' in email) > 1)
);

create unique index if not exists outreach_gmail_accounts_user_email_idx
  on public.outreach_gmail_accounts (user_id, lower(email));

create index if not exists outreach_gmail_accounts_user_idx
  on public.outreach_gmail_accounts (user_id, connected_at desc);

comment on table public.outreach_gmail_accounts is
  'Google accounts a user connected for Gmail sending. Refresh tokens are encrypted and hidden from the client.';

alter table public.outreach_gmail_accounts enable row level security;

drop policy if exists outreach_gmail_accounts_select on public.outreach_gmail_accounts;
create policy outreach_gmail_accounts_select on public.outreach_gmail_accounts
  for select to authenticated
  using (user_id = auth.uid() and org_id = public.my_org_id() and public.access_open());

revoke all on table public.outreach_gmail_accounts from anon, authenticated;
grant select (id, org_id, user_id, email, connected_at, last_used_at)
  on public.outreach_gmail_accounts to authenticated;

-- Redacted change_log: never store the encrypted token material.
create or replace function public.outreach_gmail_accounts_change_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec jsonb;
  old_rec jsonb;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rec := rec - 'refresh_token_cipher' - 'refresh_token_iv';
  old_rec := case when tg_op = 'UPDATE' then (to_jsonb(old) - 'refresh_token_cipher' - 'refresh_token_iv') else null end;
  if tg_op = 'DELETE' then
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values ('outreach_gmail_accounts', old.id::text, 'delete', rec, null, auth.uid());
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values ('outreach_gmail_accounts', new.id::text, 'update', old_rec, rec, auth.uid());
    return new;
  else
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values ('outreach_gmail_accounts', new.id::text, 'insert', null, rec, auth.uid());
    return new;
  end if;
end;
$$;

drop trigger if exists outreach_gmail_accounts_change_log on public.outreach_gmail_accounts;
create trigger outreach_gmail_accounts_change_log
  after insert or update or delete on public.outreach_gmail_accounts
  for each row execute function public.outreach_gmail_accounts_change_log();

create or replace function public.save_gmail_account(account_email text, cipher text, iv text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  aid uuid;
  clean text := lower(trim(account_email));
begin
  if auth.uid() is null or not public.access_open() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if clean is null or position('@' in clean) < 2 or cipher is null or iv is null or cipher = '' or iv = '' then
    raise exception 'A Google account and a stored token are required.' using errcode = '22023';
  end if;

  insert into public.outreach_gmail_accounts (org_id, user_id, email, refresh_token_cipher, refresh_token_iv, connected_at)
  values (public.my_org_id(), auth.uid(), clean, cipher, iv, now())
  on conflict (user_id, email) do update
    set refresh_token_cipher = excluded.refresh_token_cipher,
        refresh_token_iv = excluded.refresh_token_iv,
        connected_at = now()
  returning id into aid;
  return aid;
end;
$$;

-- Unique on (user_id, lower(email)) is an index, not a constraint name for ON CONFLICT.
-- Use a real unique constraint instead.
alter table public.outreach_gmail_accounts
  drop constraint if exists outreach_gmail_accounts_user_email_key;
-- The unique index already exists; ON CONFLICT needs a constraint. Recreate as constraint.
drop index if exists outreach_gmail_accounts_user_email_idx;
alter table public.outreach_gmail_accounts
  add constraint outreach_gmail_accounts_user_email_key unique (user_id, email);
-- email is stored lowercased by the function, so unique on (user_id, email) is enough.

create or replace function public.gmail_account_secrets(account_id uuid)
returns table (id uuid, email text, refresh_token_cipher text, refresh_token_iv text)
language plpgsql
security definer
set search_path to 'public'
stable
as $$
begin
  if auth.uid() is null or not public.access_open() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select a.id, a.email, a.refresh_token_cipher, a.refresh_token_iv
      from public.outreach_gmail_accounts a
     where a.id = account_id
       and a.user_id = auth.uid()
       and a.org_id = public.my_org_id();
end;
$$;

create or replace function public.delete_gmail_account(account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.access_open() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  delete from public.outreach_gmail_accounts
   where id = account_id
     and user_id = auth.uid()
     and org_id = public.my_org_id();
end;
$$;

create or replace function public.touch_gmail_account(account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.outreach_gmail_accounts
     set last_used_at = now()
   where id = account_id
     and user_id = auth.uid();
end;
$$;

revoke all on function public.save_gmail_account(text, text, text) from public;
revoke all on function public.gmail_account_secrets(uuid) from public;
revoke all on function public.delete_gmail_account(uuid) from public;
revoke all on function public.touch_gmail_account(uuid) from public;
grant execute on function public.save_gmail_account(text, text, text) to authenticated;
grant execute on function public.gmail_account_secrets(uuid) to authenticated;
grant execute on function public.delete_gmail_account(uuid) to authenticated;
grant execute on function public.touch_gmail_account(uuid) to authenticated;

-- Org-level From addresses for domain (Resend) sending. Admins manage the list.
create table if not exists public.outreach_domain_senders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  from_name text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists outreach_domain_senders_org_email_idx
  on public.outreach_domain_senders (org_id, lower(email));

comment on table public.outreach_domain_senders is
  'From addresses for domain email sending (Resend). Admins add and edit them.';

alter table public.outreach_domain_senders enable row level security;

drop policy if exists outreach_domain_senders_select on public.outreach_domain_senders;
create policy outreach_domain_senders_select on public.outreach_domain_senders
  for select to authenticated
  using (org_id = public.my_org_id() and public.access_open());

drop policy if exists outreach_domain_senders_write on public.outreach_domain_senders;
create policy outreach_domain_senders_write on public.outreach_domain_senders
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

revoke all on table public.outreach_domain_senders from anon, authenticated;
grant select, insert, update, delete on table public.outreach_domain_senders to authenticated;

do $$
begin
  execute 'drop trigger if exists change_log_aiud on public.outreach_domain_senders';
  execute 'create trigger change_log_aiud
     after insert or update or delete on public.outreach_domain_senders
     for each row execute function public.change_log_capture()';
end
$$;

insert into public.outreach_domain_senders (org_id, email, from_name, sort_order)
select o.id, t.email, t.from_name, t.sort_order
from public.organizations o
cross join (
  values
    ('info@chabadora.com', 'Chabad of the Rural Areas', 1),
    ('maine@chabadora.com', 'Chabad of Maine', 2)
) as t(email, from_name, sort_order)
where not exists (
  select 1 from public.outreach_domain_senders existing
   where existing.org_id = o.id and lower(existing.email) = lower(t.email)
);

-- Per-recipient send log fields (additive). Existing mailto/SMS rows stay as they are.
alter table public.outreach_sends add column if not exists method text;
alter table public.outreach_sends add column if not exists to_address text;
alter table public.outreach_sends add column if not exists status text;
alter table public.outreach_sends add column if not exists error text;
alter table public.outreach_sends add column if not exists household_id uuid;
alter table public.outreach_sends add column if not exists person_id uuid;

comment on column public.outreach_sends.method is 'gmail, resend, mailto, sms, whatsapp, or google_voice.';
comment on column public.outreach_sends.status is 'sent, failed, or skipped for CRM sends.';

-- Opt-out updates from the public unsubscribe link (signed token, no login).
create or replace function public.set_person_email_opt_out(target_id uuid, opted_out boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
begin
  update public.people
     set email_opt_out = opted_out
   where id = target_id;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.set_person_email_opt_out(uuid, boolean) from public;
-- Called from the server after verifying a signed token. Grant to authenticated
-- and also used via the service path; the Next.js route uses the user client
-- when signed in, otherwise this function is executable by the anon role with
-- no other person fields exposed.
grant execute on function public.set_person_email_opt_out(uuid, boolean) to anon, authenticated;
