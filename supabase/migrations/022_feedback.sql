-- Feedback from any signed-in user. Anyone can insert their own row.
-- Only Cora admins can read and update (mark read / archive).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default '',
  role text not null default '',
  state text not null default '',
  message text not null,
  page text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_archived_idx on public.feedback (archived_at, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback for select to authenticated
  using (public.is_admin());

drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.feedback to authenticated;
