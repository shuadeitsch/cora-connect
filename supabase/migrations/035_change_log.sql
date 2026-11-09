-- 1.8.33: schema-level audit/backup so Mendel can restore anything a user removes or changes.
-- Soft-hide (shliach deleted_by_shliach_*) stays; this also logs hard deletes and updates.

create table if not exists public.change_log (
  id bigserial primary key,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_row jsonb,
  new_row jsonb,
  actor uuid,
  at timestamptz not null default now()
);

create index if not exists change_log_table_row_idx on public.change_log (table_name, row_id, at desc);
create index if not exists change_log_at_idx on public.change_log (at desc);
create index if not exists change_log_actor_idx on public.change_log (actor, at desc);

comment on table public.change_log is 'Append-only audit of user-data changes. Admins may read; clients cannot write. Restore via docs/RESTORE.md.';

alter table public.change_log enable row level security;

drop policy if exists change_log_admin_read on public.change_log;
create policy change_log_admin_read on public.change_log
  for select to authenticated
  using (public.is_admin());

-- No client writes. Triggers run as SECURITY DEFINER (owner) and still insert.
revoke all on table public.change_log from anon, authenticated;
grant select on table public.change_log to authenticated;
grant usage, select on sequence public.change_log_id_seq to authenticated;

create or replace function public.change_log_row_id(row_data jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(row_data->>'id', ''),
    nullif(
      concat_ws(
        '|',
        row_data->>'household_id',
        row_data->>'category_id',
        row_data->>'bochur_id',
        row_data->>'route_id',
        row_data->>'user_id',
        row_data->>'a_id',
        row_data->>'b_id',
        row_data->>'day_id',
        row_data->>'notification_id',
        row_data->>'note_id',
        row_data->>'email',
        row_data->>'state',
        row_data->>'area'
      ),
      ''
    ),
    md5(row_data::text)
  );
$$;

create or replace function public.change_log_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid text;
begin
  if TG_OP = 'DELETE' then
    rid := public.change_log_row_id(to_jsonb(OLD));
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values (TG_TABLE_NAME, rid, 'delete', to_jsonb(OLD), null, auth.uid());
    return OLD;
  elsif TG_OP = 'UPDATE' then
    -- Skip no-op updates (same row payload) to keep noise down.
    if to_jsonb(NEW) is not distinct from to_jsonb(OLD) then
      return NEW;
    end if;
    rid := public.change_log_row_id(to_jsonb(NEW));
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values (TG_TABLE_NAME, rid, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    return NEW;
  elsif TG_OP = 'INSERT' then
    rid := public.change_log_row_id(to_jsonb(NEW));
    insert into public.change_log (table_name, row_id, action, old_row, new_row, actor)
    values (TG_TABLE_NAME, rid, 'insert', null, to_jsonb(NEW), auth.uid());
    return NEW;
  end if;
  return null;
end;
$$;

revoke all on function public.change_log_capture() from public;
revoke all on function public.change_log_row_id(jsonb) from public;

-- Attach AFTER INSERT OR UPDATE OR DELETE on every user-data table (not change_log itself).
do $$
declare
  t text;
  tables text[] := array[
    'households',
    'people',
    'household_categories',
    'contact_visits',
    'visits',
    'routes',
    'route_stops',
    'route_assignments',
    'planner_days',
    'planner_items',
    'profiles',
    'feedback',
    'contact_edit_suggestions',
    'contact_shares',
    'projects',
    'categories',
    'custom_field_defs',
    'organizations',
    'invites',
    'territories',
    'notifications',
    'notification_reads',
    'not_duplicate_pairs',
    'sichos_review_answers',
    'admin_emails',
    'preapproved_admins'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'change_log: skip missing table %', t;
      continue;
    end if;
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
