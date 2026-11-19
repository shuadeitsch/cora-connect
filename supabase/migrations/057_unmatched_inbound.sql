-- Inbound messages from senders that match no contact used to be dropped. Keep them here so an admin
-- can attach them to a contact, create a contact from them, or dismiss them.
create table if not exists public.message_unmatched (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel_type text not null check (channel_type in ('email_gmail','email_resend','sms_twilio','whatsapp_twilio','email','sms','whatsapp')),
  address text not null,
  sender_name text,
  subject text,
  body text not null default '',
  provider text not null,
  provider_message_id text not null,
  channel_id uuid,
  status text not null default 'open' check (status in ('open','attached','dismissed')),
  received_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_household_id uuid,
  unique (provider, provider_message_id)
);
create index if not exists message_unmatched_open_idx on public.message_unmatched (org_id, status, received_at desc);
alter table public.message_unmatched enable row level security;
-- No policies on purpose: all access goes through the functions below.

create or replace function public.ingest_unmatched_message(p_key text, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  org uuid;
  typ text := coalesce(payload->>'channel_type', '');
  addr text := trim(coalesce(payload->>'address', ''));
  mid text := nullif(payload->>'provider_message_id', '');
  prov text := nullif(payload->>'provider', '');
  existing uuid;
  new_id uuid;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  if addr = '' or mid is null or prov is null then
    return null;
  end if;
  begin org := nullif(payload->>'org_id', '')::uuid; exception when others then org := null; end;
  if org is null then
    select id into org from public.organizations order by created_at limit 1;
  end if;
  select id into existing from public.message_unmatched where provider = prov and provider_message_id = mid;
  if existing is not null then return existing; end if;
  insert into public.message_unmatched (org_id, channel_type, address, sender_name, subject, body, provider, provider_message_id, channel_id)
  values (org, typ, addr, nullif(payload->>'sender_name', ''), nullif(payload->>'subject', ''), left(coalesce(payload->>'body', ''), 20000), prov, mid,
          nullif(payload->>'channel_id', '')::uuid)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.ingest_unmatched_message(text, jsonb) from public;
grant execute on function public.ingest_unmatched_message(text, jsonb) to anon, authenticated;

-- Admins only; the address is hidden from anyone who cannot see contact info.
create or replace function public.list_unmatched_messages()
returns table(id uuid, channel_type text, address text, sender_name text, subject text, body text, received_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select u.id, u.channel_type,
           case when public.can_view_contact() then u.address else '' end,
           u.sender_name, u.subject, u.body, u.received_at, u.status
      from public.message_unmatched u
     where u.org_id = public.my_org_id() and u.status = 'open'
     order by u.received_at desc
     limit 200;
end;
$$;
revoke all on function public.list_unmatched_messages() from public;
grant execute on function public.list_unmatched_messages() to authenticated;

-- Returns the full row (including the address) to an admin who may see contact info, so it can be attached.
create or replace function public.get_unmatched_message(p_id uuid)
returns table(id uuid, org_id uuid, channel_type text, address text, sender_name text, subject text, body text, provider text, provider_message_id text, channel_id uuid, status text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.is_admin() or not public.can_view_contact() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select u.id, u.org_id, u.channel_type, u.address, u.sender_name, u.subject, u.body, u.provider, u.provider_message_id, u.channel_id, u.status
      from public.message_unmatched u
     where u.id = p_id and u.org_id = public.my_org_id();
end;
$$;
revoke all on function public.get_unmatched_message(uuid) from public;
grant execute on function public.get_unmatched_message(uuid) to authenticated;

create or replace function public.resolve_unmatched_message(p_id uuid, p_status text, p_household uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_status not in ('attached','dismissed') then
    raise exception 'Bad status.' using errcode = '22023';
  end if;
  update public.message_unmatched
     set status = p_status, resolved_at = now(), resolved_by = auth.uid(), resolved_household_id = p_household
   where id = p_id and org_id = public.my_org_id() and status = 'open';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.resolve_unmatched_message(uuid, text, uuid) from public;
grant execute on function public.resolve_unmatched_message(uuid, text, uuid) to authenticated;

-- Also match a sender against a contact's extra phone numbers (4th number onward).
create or replace function public.match_contact_address(p_key text, p_org uuid, p_family text, p_address text)
returns table(org_id uuid, household_id uuid, person_id uuid, name text)
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
  if length(digits) > 10 then last10 := right(digits, 10); else last10 := digits; end if;
  if p_family = 'email' then
    return query
      select h.org_id, pe.household_id, pe.id, pe.name
        from public.people pe join public.households h on h.id = pe.household_id
       where lower(pe.email) = email and (p_org is null or h.org_id = p_org)
       limit 1;
    return;
  end if;
  return query
    select h.org_id, pe.household_id, pe.id, pe.name
      from public.people pe join public.households h on h.id = pe.household_id
     where (p_org is null or h.org_id = p_org)
       and (
         right(regexp_replace(coalesce(pe.phone, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.phone2, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.phone3, ''), '\D', '', 'g'), 10) = last10
         or right(regexp_replace(coalesce(pe.whatsapp, ''), '\D', '', 'g'), 10) = last10
         or exists (select 1 from unnest(coalesce(pe.extra_phones, '{}'::text[])) x where right(regexp_replace(x, '\D', '', 'g'), 10) = last10)
       )
     limit 1;
end;
$$;
