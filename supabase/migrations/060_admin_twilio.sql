-- Admin-only Twilio tracking: hand-entered top-up settings and a payments log.
-- Twilio exposes neither auto-recharge settings nor payment history by API.
create table if not exists public.admin_twilio_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  topup_enabled boolean not null default false,
  topup_threshold numeric(10,2),
  topup_amount numeric(10,2),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_twilio_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  paid_on date not null,
  amount numeric(10,2) not null check (amount > 0),
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists admin_twilio_payments_org_idx on public.admin_twilio_payments (org_id, paid_on desc);

alter table public.admin_twilio_settings enable row level security;
alter table public.admin_twilio_payments enable row level security;

drop policy if exists admin_twilio_settings_admin on public.admin_twilio_settings;
create policy admin_twilio_settings_admin on public.admin_twilio_settings
  for all to authenticated
  using (public.is_admin() and org_id = public.my_org_id())
  with check (public.is_admin() and org_id = public.my_org_id());

drop policy if exists admin_twilio_payments_admin on public.admin_twilio_payments;
create policy admin_twilio_payments_admin on public.admin_twilio_payments
  for all to authenticated
  using (public.is_admin() and org_id = public.my_org_id())
  with check (public.is_admin() and org_id = public.my_org_id());

revoke all on public.admin_twilio_settings, public.admin_twilio_payments from anon;
