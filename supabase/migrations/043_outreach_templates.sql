-- 1.8.58: org email/SMS templates that admins can create, edit, and delete.
create table if not exists public.outreach_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  subject text not null default '',
  email text not null default '',
  sms text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists outreach_templates_org_idx
  on public.outreach_templates (org_id, sort_order, name);

comment on table public.outreach_templates is
  'Email and text message templates for outreach. Admins manage them; shliachim can use them.';

alter table public.outreach_templates enable row level security;

drop policy if exists outreach_templates_select on public.outreach_templates;
create policy outreach_templates_select on public.outreach_templates
  for select to authenticated
  using (org_id = public.my_org_id() and public.access_open());

drop policy if exists outreach_templates_write on public.outreach_templates;
create policy outreach_templates_write on public.outreach_templates
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

revoke all on table public.outreach_templates from anon, authenticated;
grant select, insert, update, delete on table public.outreach_templates to authenticated;

-- Seed the current built-in drafts once per organization.
insert into public.outreach_templates (org_id, name, subject, email, sms, sort_order)
select o.id, t.name, t.subject, t.email, t.sms, t.sort_order
from public.organizations o
cross join (
  values
    (
      'Visit announcement',
      'Yeshiva students visiting {state}',
      'Hi {first name}, Chabad of {state} is sending yeshiva students to visit {state}. Please let us know if you''re interested!',
      'Hi {first name}, Chabad of {state} is sending yeshiva students to visit {state}. Please let us know if you''re interested!',
      1
    ),
    (
      'Chanukah / holiday visit',
      'Chanukah visit from Chabad of {state}',
      'Hi {first name}, Chabad of {state} would love to visit you this Chanukah. May we stop by with a menorah, candles, and a little holiday cheer?',
      'Hi {first name}, Chabad of {state} would love to visit for Chanukah. May we stop by with a menorah and candles?',
      2
    ),
    (
      'Follow-up thank you',
      'Thank you from Chabad of {state}',
      'Hi {first name}, thank you for welcoming us. It was a pleasure to visit. If you''d like us to come again, or if we can help with anything, just reply to this message. Wishing you all the best from Chabad of {state}.',
      'Hi {first name}, thank you for welcoming us. If you''d like another visit, or if we can help with anything, just reply. — Chabad of {state}',
      3
    ),
    (
      'We''re in the area',
      'A visit from Chabad of {state}',
      'Hi {first name}, we''ll have yeshiva students in {state} soon and would love to stop by for a short visit. If there''s a day or time that works, please let us know. Looking forward to seeing you.',
      'Hi {first name}, yeshiva students will be in {state} soon and would love to stop by. If a time works for you, please let us know!',
      4
    )
) as t(name, subject, email, sms, sort_order)
where not exists (
  select 1 from public.outreach_templates existing where existing.org_id = o.id
);

create table if not exists public.outreach_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  mode text not null,
  template_id text,
  template_name text,
  subject text not null default '',
  body text not null default '',
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists outreach_sends_org_idx
  on public.outreach_sends (org_id, created_at desc);

comment on table public.outreach_sends is
  'A record that someone opened a customized outreach draft in their email or text app.';

alter table public.outreach_sends enable row level security;

drop policy if exists outreach_sends_select on public.outreach_sends;
create policy outreach_sends_select on public.outreach_sends
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and public.access_open()
    and (public.is_admin() or actor_id = auth.uid())
  );

drop policy if exists outreach_sends_insert on public.outreach_sends;
create policy outreach_sends_insert on public.outreach_sends
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and public.access_open()
    and public.my_role() in ('admin', 'shliach')
  );

revoke all on table public.outreach_sends from anon, authenticated;
grant select, insert on table public.outreach_sends to authenticated;

-- Audit both new tables the same way as other user data.
do $$
declare
  t text;
begin
  foreach t in array array['outreach_templates', 'outreach_sends'] loop
    execute format('drop trigger if exists change_log_aiud on public.%I', t);
    execute format(
      'create trigger change_log_aiud
         after insert or update or delete on public.%I
         for each row execute function public.change_log_capture()',
      t
    );
  end loop;
end
$$;
