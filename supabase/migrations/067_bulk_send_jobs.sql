-- Bulk sends run on the server as a job, so they keep going after the sender closes the window.
-- One row per bulk send; items are the prepared messages, claimed one at a time (never sent twice).
create table if not exists public.bulk_send_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  label text not null default '',
  status text not null default 'running' check (status in ('running', 'done', 'stopped')),
  items jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  next_index integer not null default 0,
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists bulk_send_jobs_org_created_idx on public.bulk_send_jobs (org_id, created_at desc);

alter table public.bulk_send_jobs enable row level security;

-- The sender, or an admin of the same org.
drop policy if exists bulk_send_jobs_all on public.bulk_send_jobs;
create policy bulk_send_jobs_all on public.bulk_send_jobs for all to authenticated
  using (org_id = public.my_org_id() and public.access_open() and (created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')))
  with check (org_id = public.my_org_id() and public.access_open() and (created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')));
revoke all on table public.bulk_send_jobs from anon;
grant select, insert, update on table public.bulk_send_jobs to authenticated;

-- Claim the next message atomically (row lock), so two workers never send the same one.
create or replace function public.claim_bulk_send_item(p_job uuid)
returns table (idx integer, item jsonb)
language sql security invoker set search_path = public
as $function$
  update public.bulk_send_jobs j
     set next_index = j.next_index + 1, lease_until = now() + interval '90 seconds', updated_at = now()
   where j.id = p_job and j.status = 'running' and j.next_index < j.total
  returning j.next_index - 1, j.items -> (j.next_index - 1);
$function$;

-- Record one result; the job is done once every message has a result.
create or replace function public.finish_bulk_send_item(p_job uuid, p_ok boolean, p_name text, p_error text)
returns void
language sql security invoker set search_path = public
as $function$
  update public.bulk_send_jobs j
     set sent = j.sent + case when p_ok then 1 else 0 end,
         failed = j.failed + case when p_ok then 0 else 1 end,
         results = j.results || jsonb_build_array(jsonb_build_object('name', p_name, 'ok', p_ok, 'error', p_error)),
         status = case when j.sent + j.failed + 1 >= j.total then 'done' else j.status end,
         finished_at = case when j.sent + j.failed + 1 >= j.total then now() else j.finished_at end,
         lease_until = case when j.sent + j.failed + 1 >= j.total then null else now() + interval '90 seconds' end,
         updated_at = now()
   where j.id = p_job;
$function$;

revoke all on function public.claim_bulk_send_item(uuid) from public, anon;
revoke all on function public.finish_bulk_send_item(uuid, boolean, text, text) from public, anon;
grant execute on function public.claim_bulk_send_item(uuid) to authenticated;
grant execute on function public.finish_bulk_send_item(uuid, boolean, text, text) to authenticated;
