-- 1.8.65: two-way messaging core (channels, threads, inbound ingest, opt-outs).

alter table public.people
  add column if not exists sms_opt_out boolean not null default false,
  add column if not exists whatsapp_opt_out boolean not null default false;

comment on column public.people.sms_opt_out is
  'True after a STOP (or similar) on SMS. UNSTOP clears it.';
comment on column public.people.whatsapp_opt_out is
  'True when this person has opted out of WhatsApp outreach.';

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
  pe.email_opt_out,
  pe.sms_opt_out,
  pe.whatsapp_opt_out
from public.people pe
where public.can_see_household(pe.household_id);

grant select on public.people_visible to authenticated;

create or replace function public.set_person_channel_opt_out(target_id uuid, channel text, opted_out boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if channel = 'email' then
    update public.people set email_opt_out = opted_out where id = target_id;
  elsif channel = 'sms' then
    update public.people set sms_opt_out = opted_out where id = target_id;
  elsif channel = 'whatsapp' then
    update public.people set whatsapp_opt_out = opted_out where id = target_id;
  else
    raise exception 'Unknown opt-out channel.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.set_person_channel_opt_out(uuid, text, boolean) from public;
grant execute on function public.set_person_channel_opt_out(uuid, text, boolean) to authenticated;

alter table public.outreach_gmail_accounts
  add column if not exists history_id text,
  add column if not exists scopes text,
  add column if not exists can_read boolean not null default false;

grant select (id, org_id, user_id, email, connected_at, last_used_at, history_id, scopes, can_read)
  on public.outreach_gmail_accounts to authenticated;

alter table public.preplanner_entries
  add column if not exists replied_at timestamptz;

comment on column public.preplanner_entries.replied_at is
  'Set when an inbound reply is attached to this entry.';

create table if not exists public.outreach_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  label text not null,
  address text not null,
  default_states text[] not null default '{}',
  gmail_account_id uuid references public.outreach_gmail_accounts (id) on delete set null,
  domain_sender_id uuid,
  status text not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_channels_type_check check (type in ('email_gmail', 'email_resend', 'sms_twilio', 'whatsapp_twilio')),
  constraint outreach_channels_status_check check (status in ('active', 'disconnected'))
);

create index if not exists outreach_channels_org_idx on public.outreach_channels (org_id, status, type);

comment on table public.outreach_channels is
  'Org or per-shliach sending identities. Provider secrets stay in env or in token tables, never on this row.';

alter table public.outreach_channels enable row level security;

drop policy if exists outreach_channels_select on public.outreach_channels;
create policy outreach_channels_select on public.outreach_channels
  for select to authenticated
  using (org_id = public.my_org_id() and public.access_open() and status = 'active');

drop policy if exists outreach_channels_admin_write on public.outreach_channels;
create policy outreach_channels_admin_write on public.outreach_channels
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

revoke all on table public.outreach_channels from anon, authenticated;
grant select, insert, update, delete on table public.outreach_channels to authenticated;

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  channel_id uuid references public.outreach_channels (id) on delete set null,
  channel_type text not null,
  contact_address text not null,
  project_id uuid,
  last_at timestamptz not null default now(),
  last_preview text not null default '',
  last_direction text not null default 'out',
  unread_count integer not null default 0,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_threads_type_check check (channel_type in ('email_gmail', 'email_resend', 'sms_twilio', 'whatsapp_twilio', 'email', 'sms', 'whatsapp')),
  constraint message_threads_direction_check check (last_direction in ('in', 'out'))
);

create unique index if not exists message_threads_unique_idx
  on public.message_threads (org_id, household_id, channel_type, lower(contact_address));

create index if not exists message_threads_org_last_idx
  on public.message_threads (org_id, last_at desc);

alter table public.message_threads enable row level security;

drop policy if exists message_threads_select on public.message_threads;
create policy message_threads_select on public.message_threads
  for select to authenticated
  using (org_id = public.my_org_id() and public.can_see_household(household_id));

drop policy if exists message_threads_write on public.message_threads;
create policy message_threads_write on public.message_threads
  for all to authenticated
  using (org_id = public.my_org_id() and public.can_edit_household(household_id))
  with check (org_id = public.my_org_id() and public.can_edit_household(household_id));

revoke all on table public.message_threads from anon, authenticated;
grant select, insert, update, delete on table public.message_threads to authenticated;

create table if not exists public.message_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  channel_id uuid references public.outreach_channels (id) on delete set null,
  channel_type text not null,
  direction text not null,
  body text not null default '',
  subject text,
  status text not null default 'sent',
  error text,
  provider text,
  provider_message_id text,
  template_name text,
  template_vars jsonb,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint message_messages_direction_check check (direction in ('in', 'out')),
  constraint message_messages_status_check check (status in ('queued', 'sent', 'delivered', 'failed', 'received'))
);

create unique index if not exists message_messages_provider_id_idx
  on public.message_messages (provider, provider_message_id)
  where provider is not null and provider_message_id is not null;

create index if not exists message_messages_thread_idx
  on public.message_messages (thread_id, created_at);

alter table public.message_messages enable row level security;

drop policy if exists message_messages_select on public.message_messages;
create policy message_messages_select on public.message_messages
  for select to authenticated
  using (org_id = public.my_org_id() and public.can_see_household(household_id));

drop policy if exists message_messages_write on public.message_messages;
create policy message_messages_write on public.message_messages
  for all to authenticated
  using (org_id = public.my_org_id() and public.can_edit_household(household_id))
  with check (org_id = public.my_org_id() and public.can_edit_household(household_id));

revoke all on table public.message_messages from anon, authenticated;
grant select, insert, update, delete on table public.message_messages to authenticated;

-- Hash of MESSAGING_INGEST_KEY; never granted to the client.
create table if not exists public.messaging_runtime (
  id boolean primary key default true check (id),
  ingest_key_sha256 text
);

alter table public.messaging_runtime enable row level security;
revoke all on table public.messaging_runtime from anon, authenticated;

create or replace function public.messaging_key_ok(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  hashed text;
  stored text;
begin
  if p_key is null or length(p_key) < 16 then
    return false;
  end if;
  begin
    hashed := encode(extensions.digest(convert_to(p_key, 'utf8'), 'sha256'), 'hex');
  exception when others then
    hashed := encode(digest(convert_to(p_key, 'utf8'), 'sha256'), 'hex');
  end;
  select ingest_key_sha256 into stored from public.messaging_runtime where id = true;
  return stored is not null and stored = hashed;
end;
$$;

revoke all on function public.messaging_key_ok(text) from public, anon, authenticated;

create or replace function public.ingest_inbound_message(p_key text, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  org uuid;
  hid uuid;
  pid uuid;
  typ text;
  addr text;
  body text;
  subj text;
  provider text;
  mid text;
  cid uuid;
  project uuid;
  tid uuid;
  msg uuid;
  existing uuid;
  note text;
  how text;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;

  typ := coalesce(payload->>'channel_type', '');
  addr := lower(trim(coalesce(payload->>'contact_address', '')));
  body := coalesce(payload->>'body', '');
  subj := nullif(payload->>'subject', '');
  provider := nullif(payload->>'provider', '');
  mid := nullif(payload->>'provider_message_id', '');
  begin
    cid := nullif(payload->>'channel_id', '')::uuid;
  exception when others then
    cid := null;
  end;
  begin
    org := nullif(payload->>'org_id', '')::uuid;
  exception when others then
    org := null;
  end;
  begin
    hid := nullif(payload->>'household_id', '')::uuid;
  exception when others then
    hid := null;
  end;
  begin
    pid := nullif(payload->>'person_id', '')::uuid;
  exception when others then
    pid := null;
  end;
  begin
    project := nullif(payload->>'project_id', '')::uuid;
  exception when others then
    project := null;
  end;

  if typ not in ('email_gmail', 'email_resend', 'sms_twilio', 'whatsapp_twilio', 'email', 'sms', 'whatsapp') then
    raise exception 'Unknown channel type.' using errcode = '22023';
  end if;
  if addr = '' then
    raise exception 'A contact address is required.' using errcode = '22023';
  end if;

  if mid is not null and provider is not null then
    select id into existing
      from public.message_messages
     where message_messages.provider = ingest_inbound_message.provider
       and provider_message_id = mid
     limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  if hid is null then
    raise exception 'No matching contact.' using errcode = 'P0002';
  end if;
  if org is null then
    select org_id into org from public.households where id = hid;
  end if;

  select id into tid
    from public.message_threads
   where org_id = org
     and household_id = hid
     and channel_type = typ
     and lower(contact_address) = addr
   limit 1;

  if tid is null then
    insert into public.message_threads (
      org_id, household_id, person_id, channel_id, channel_type, contact_address, project_id,
      last_at, last_preview, last_direction, unread_count, last_inbound_at
    ) values (
      org, hid, pid, cid, typ, addr, project,
      now(), left(body, 180), 'in', 1, now()
    )
    returning id into tid;
  else
    update public.message_threads
       set last_at = now(),
           last_preview = left(body, 180),
           last_direction = 'in',
           unread_count = coalesce(unread_count, 0) + 1,
           last_inbound_at = now(),
           person_id = coalesce(message_threads.person_id, pid),
           channel_id = coalesce(message_threads.channel_id, cid),
           project_id = coalesce(message_threads.project_id, project)
     where id = tid;
  end if;

  insert into public.message_messages (
    thread_id, org_id, household_id, person_id, channel_id, channel_type,
    direction, body, subject, status, provider, provider_message_id
  ) values (
    tid, org, hid, pid, cid, typ,
    'in', body, subj, 'received', provider, mid
  )
  returning id into msg;

  how := case
    when typ in ('email_gmail', 'email_resend', 'email') then 'email'
    when typ in ('whatsapp_twilio', 'whatsapp') then 'whatsapp'
    else 'text'
  end;
  note := case when subj is not null and subj <> '' then subj || E'\n' || body else body end;

  -- Attach to the latest open Pre-planner entry, or start a Reached out row.
  if exists (
    select 1 from public.preplanner_entries e
     where e.household_id = hid and e.org_id = org
  ) then
    update public.preplanner_entries e
       set replied_at = now(),
           notes_log = coalesce(e.notes_log, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object('at', now(), 'text', note, 'by', 'Reply')
           ),
           notes = case when coalesce(e.notes, '') = '' then note else e.notes || E'\n\n' || note end,
           reached_hows = case
             when how = any(coalesce(e.reached_hows, '{}')) then e.reached_hows
             else coalesce(e.reached_hows, '{}') || array[how]
           end,
           updated_at = now()
     where e.id = (
       select e2.id from public.preplanner_entries e2
        where e2.household_id = hid and e2.org_id = org
        order by (e2.stage = 'reached_out') desc, e2.created_at desc
        limit 1
     );
  else
    insert into public.preplanner_entries (
      org_id, household_id, stage, reached_date, reached_time, reached_how, reached_hows,
      follow_up_how, notes, notes_log, project_id, replied_at
    ) values (
      org, hid, 'reached_out', (now() at time zone 'America/New_York')::date,
      to_char(now() at time zone 'America/New_York', 'HH24:MI'),
      how, array[how], how, note,
      jsonb_build_array(jsonb_build_object('at', now(), 'text', note, 'by', 'Reply')),
      project, now()
    );
  end if;

  return msg;
end;
$$;

revoke all on function public.ingest_inbound_message(text, jsonb) from public;
grant execute on function public.ingest_inbound_message(text, jsonb) to anon, authenticated;

create or replace function public.gmail_sync_accounts(p_key text)
returns table (
  id uuid,
  org_id uuid,
  user_id uuid,
  email text,
  refresh_token_cipher text,
  refresh_token_iv text,
  history_id text,
  can_read boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  return query
    select a.id, a.org_id, a.user_id, a.email, a.refresh_token_cipher, a.refresh_token_iv, a.history_id, a.can_read
      from public.outreach_gmail_accounts a
     where a.can_read = true;
end;
$$;

revoke all on function public.gmail_sync_accounts(text) from public;
grant execute on function public.gmail_sync_accounts(text) to anon, authenticated;

create or replace function public.gmail_save_history(p_key text, p_account uuid, p_history_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  update public.outreach_gmail_accounts
     set history_id = p_history_id, last_used_at = now()
   where id = p_account;
end;
$$;

revoke all on function public.gmail_save_history(text, uuid, text) from public;
grant execute on function public.gmail_save_history(text, uuid, text) to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['outreach_channels', 'message_threads', 'message_messages']
  loop
    execute format('drop trigger if exists change_log_aiud on public.%I', t);
    execute format(
      'create trigger change_log_aiud after insert or update or delete on public.%I for each row execute function public.change_log_capture()',
      t
    );
  end loop;
end;
$$;

create or replace function public.set_person_channel_opt_out_ingest(p_key text, target_id uuid, channel text, opted_out boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  perform public.set_person_channel_opt_out(target_id, channel, opted_out);
end;
$$;

revoke all on function public.set_person_channel_opt_out_ingest(text, uuid, text, boolean) from public;
grant execute on function public.set_person_channel_opt_out_ingest(text, uuid, text, boolean) to anon, authenticated;

create or replace function public.match_contact_address(p_key text, p_org uuid, p_family text, p_address text)
returns table (org_id uuid, household_id uuid, person_id uuid, name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  email text := lower(trim(p_address));
  digits text := regexp_replace(p_address, '\D', '', 'g');
  last10 text;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  if length(digits) > 10 then
    last10 := right(digits, 10);
  else
    last10 := digits;
  end if;
  if p_family = 'email' then
    return query
      select h.org_id, pe.household_id, pe.id, pe.name
        from public.people pe
        join public.households h on h.id = pe.household_id
       where lower(pe.email) = email
         and (p_org is null or h.org_id = p_org)
       limit 1;
    return;
  end if;
  return query
    select h.org_id, pe.household_id, pe.id, pe.name
      from public.people pe
      join public.households h on h.id = pe.household_id
     where (p_org is null or h.org_id = p_org)
       and (
         right(regexp_replace(coalesce(pe.phone, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.phone2, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.phone3, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.whatsapp, ''), '\D', '', 'g'), 10) = last10
       )
     limit 1;
end;
$$;

revoke all on function public.match_contact_address(text, uuid, text, text) from public;
grant execute on function public.match_contact_address(text, uuid, text, text) to anon, authenticated;

create or replace function public.lookup_messaging_channel(p_key text, p_address text)
returns table (id uuid, org_id uuid, type text, address text, owner_user_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  digits text := right(regexp_replace(coalesce(p_address, ''), '\D', '', 'g'), 10);
  email text := lower(trim(regexp_replace(coalesce(p_address, ''), '^whatsapp:', '')));
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  return query
    select c.id, c.org_id, c.type, c.address, c.owner_user_id
      from public.outreach_channels c
     where c.status = 'active'
       and (
         lower(c.address) = email
         or lower(replace(c.address, 'whatsapp:', '')) = email
         or right(regexp_replace(c.address, '\D', '', 'g'), 10) = digits
       )
     limit 1;
end;
$$;

revoke all on function public.lookup_messaging_channel(text, text) from public;
grant execute on function public.lookup_messaging_channel(text, text) to anon, authenticated;

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

  insert into public.outreach_gmail_accounts (
    org_id, user_id, email, refresh_token_cipher, refresh_token_iv, connected_at, can_read, scopes, history_id
  )
  values (
    public.my_org_id(), auth.uid(), clean, cipher, iv, now(), true,
    'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
    null
  )
  on conflict (user_id, email) do update
    set refresh_token_cipher = excluded.refresh_token_cipher,
        refresh_token_iv = excluded.refresh_token_iv,
        connected_at = now(),
        can_read = true,
        scopes = excluded.scopes,
        history_id = null
  returning id into aid;
  return aid;
end;
$$;
