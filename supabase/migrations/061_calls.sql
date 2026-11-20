-- Browser calling: a log of every call made or received through the CRM (Twilio Voice).
-- Webhooks write through key-gated SECURITY DEFINER functions (same MESSAGING_INGEST_KEY as messaging).
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  person_id uuid references public.people (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_number text not null default '',
  to_number text not null default '',
  contact_number text not null default '',
  twilio_call_sid text not null unique,
  status text not null default 'initiated',
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_sid text,
  recording_url text,
  recording_duration integer,
  voicemail boolean not null default false,
  outcome text check (outcome is null or outcome in ('answered','no_answer','left_voicemail','wrong_number','busy','not_interested','call_back_later')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists calls_household_idx on public.calls (household_id, started_at desc);
create index if not exists calls_org_started_idx on public.calls (org_id, started_at desc);

create table if not exists public.voice_clients (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table public.voice_clients enable row level security;
alter table public.calls enable row level security;

drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls for select to authenticated
  using (
    org_id = public.my_org_id()
    and (
      public.is_admin()
      or user_id = auth.uid()
      or (household_id is not null and public.can_see_household(household_id))
    )
  );
drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls for update to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_admin() or user_id = auth.uid() or (household_id is not null and public.can_edit_household(household_id)))
  )
  with check (org_id = public.my_org_id());

revoke all on table public.calls from anon, authenticated;
grant select on public.calls to authenticated;
grant update (outcome, notes) on public.calls to authenticated;
revoke all on table public.voice_clients from anon, authenticated;

-- Current user marks their browser as able to take calls.
create or replace function public.voice_client_seen() returns void
language sql security definer set search_path to 'public' as $$
  insert into public.voice_clients (user_id, last_seen) select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_seen = now();
$$;
revoke all on function public.voice_client_seen() from public, anon;
grant execute on function public.voice_client_seen() to authenticated;

-- Outbound: only a number saved on a contact in the caller's own organisation can be dialled.
create or replace function public.voice_resolve_outbound(p_key text, p_user uuid, p_number text)
returns table(org_id uuid, household_id uuid, person_id uuid, name text)
language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid;
begin
  if not public.messaging_key_ok(p_key) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select pr.org_id into v_org from public.profiles pr where pr.id = p_user and pr.status = 'approved';
  if v_org is null then return; end if;
  return query select m.org_id, m.household_id, m.person_id, m.name from public.match_contact_address(p_key, v_org, 'phone', p_number) m;
end $$;

-- Inbound: who is calling, and which signed-in browsers should ring.
create or replace function public.voice_resolve_inbound(p_key text, p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid; m record; v_ring text[];
begin
  if not public.messaging_key_ok(p_key) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select c.org_id into v_org from public.outreach_channels c
   where c.status = 'active' and right(regexp_replace(c.address, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_to,''), '\D', '', 'g'), 10) limit 1;
  if v_org is null then select o.id into v_org from public.organizations o order by o.created_at limit 1; end if;
  select * into m from public.match_contact_address(p_key, v_org, 'phone', p_from) limit 1;
  select coalesce(array_agg(vc.user_id::text), '{}') into v_ring
    from public.voice_clients vc join public.profiles pr on pr.id = vc.user_id
   where pr.org_id = v_org and pr.status = 'approved' and vc.last_seen > now() - interval '12 hours';
  return jsonb_build_object('org_id', v_org, 'household_id', m.household_id, 'person_id', m.person_id, 'name', m.name, 'ring', to_jsonb(v_ring));
end $$;

-- Create or update a call row by Twilio call SID. Only keys present in p are changed.
create or replace function public.voice_upsert_call(p_key text, p jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.messaging_key_ok(p_key) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if nullif(p->>'org_id','') is not null then
  insert into public.calls (org_id, household_id, person_id, user_id, direction, from_number, to_number, contact_number, twilio_call_sid, status)
  values ((p->>'org_id')::uuid, nullif(p->>'household_id','')::uuid, nullif(p->>'person_id','')::uuid, nullif(p->>'user_id','')::uuid,
          coalesce(p->>'direction','outbound'), coalesce(p->>'from_number',''), coalesce(p->>'to_number',''), coalesce(p->>'contact_number',''),
          p->>'sid', coalesce(p->>'status','initiated'))
  on conflict (twilio_call_sid) do nothing;
  end if;
  update public.calls c set
    status = coalesce(p->>'status', c.status),
    answered_at = coalesce(nullif(p->>'answered_at','')::timestamptz, c.answered_at),
    ended_at = coalesce(nullif(p->>'ended_at','')::timestamptz, c.ended_at),
    duration_seconds = coalesce(nullif(p->>'duration','')::int, c.duration_seconds),
    recording_sid = coalesce(nullif(p->>'recording_sid',''), c.recording_sid),
    recording_url = coalesce(nullif(p->>'recording_url',''), c.recording_url),
    recording_duration = coalesce(nullif(p->>'recording_duration','')::int, c.recording_duration),
    voicemail = c.voicemail or coalesce((p->>'voicemail')::boolean, false),
    user_id = coalesce(nullif(p->>'user_id','')::uuid, c.user_id)
  where c.twilio_call_sid = p->>'sid';
end $$;

revoke all on function public.voice_resolve_outbound(text, uuid, text), public.voice_resolve_inbound(text, text, text), public.voice_upsert_call(text, jsonb) from public;
grant execute on function public.voice_resolve_outbound(text, uuid, text), public.voice_resolve_inbound(text, text, text), public.voice_upsert_call(text, jsonb) to anon, authenticated;
