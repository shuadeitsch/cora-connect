-- 1.8.60: per-user sender addresses for outreach email, and record the from-address on sends.
create table if not exists public.outreach_sender_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  is_google boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists outreach_sender_addresses_user_email_idx
  on public.outreach_sender_addresses (user_id, lower(email));

create index if not exists outreach_sender_addresses_user_idx
  on public.outreach_sender_addresses (user_id, last_used_at desc);

comment on table public.outreach_sender_addresses is
  'Email addresses a user can send outreach from. Each row is private to that user.';

alter table public.outreach_sender_addresses enable row level security;

drop policy if exists outreach_sender_addresses_all on public.outreach_sender_addresses;
create policy outreach_sender_addresses_all on public.outreach_sender_addresses
  for all to authenticated
  using (user_id = auth.uid() and org_id = public.my_org_id() and public.access_open())
  with check (user_id = auth.uid() and org_id = public.my_org_id() and public.access_open());

revoke all on table public.outreach_sender_addresses from anon, authenticated;
grant select, insert, update, delete on table public.outreach_sender_addresses to authenticated;

alter table public.outreach_sends add column if not exists from_address text;

do $$
begin
  execute 'drop trigger if exists change_log_aiud on public.outreach_sender_addresses';
  execute 'create trigger change_log_aiud
     after insert or update or delete on public.outreach_sender_addresses
     for each row execute function public.change_log_capture()';
end
$$;

create table if not exists public.outreach_text_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  text_from text not null default 'sms',
  google_voice_number text not null default '',
  updated_at timestamptz not null default now(),
  constraint outreach_text_settings_from_check check (text_from in ('sms', 'google_voice'))
);

comment on table public.outreach_text_settings is
  'Per-user text sending preference: the phone messaging app, or Google Voice with that user''s number. Private to the user.';

alter table public.outreach_text_settings enable row level security;

drop policy if exists outreach_text_settings_all on public.outreach_text_settings;
create policy outreach_text_settings_all on public.outreach_text_settings
  for all to authenticated
  using (user_id = auth.uid() and org_id = public.my_org_id() and public.access_open())
  with check (user_id = auth.uid() and org_id = public.my_org_id() and public.access_open());

revoke all on table public.outreach_text_settings from anon, authenticated;
grant select, insert, update, delete on table public.outreach_text_settings to authenticated;

do $$
begin
  execute 'drop trigger if exists change_log_aiud on public.outreach_text_settings';
  execute 'create trigger change_log_aiud
     after insert or update or delete on public.outreach_text_settings
     for each row execute function public.change_log_capture()';
end
$$;

-- Mendel asked to text from his Google Voice number.
insert into public.outreach_text_settings (user_id, org_id, text_from, google_voice_number)
select p.id, p.org_id, 'google_voice', '(347) 770-1863'
from public.profiles p
where p.id = '7425b327-3114-4952-a5a7-dc4504f2bd1f'
   or lower(p.email) = 'mendelgreisman@gmail.com'
on conflict (user_id) do update
  set text_from = excluded.text_from,
      google_voice_number = excluded.google_voice_number,
      updated_at = now();

