# Restoring from `change_log` (1.8.33+)

Every insert/update/delete on Cora Connect user-data tables is copied into `public.change_log` by a SECURITY DEFINER trigger. Clients cannot write to that table; admins can read it. Shliach “delete contact” is still a soft-hide (`deleted_by_shliach_*`); hard deletes are logged too.

Ask the bot (or run SQL as a project owner) when something needs to come back.

## Find the change

```sql
-- Recent deletes on households (contacts)
select id, table_name, row_id, action, actor, at, old_row
from public.change_log
where table_name = 'households'
  and action = 'delete'
order by at desc
limit 20;

-- One row’s history
select id, action, at, actor, old_row, new_row
from public.change_log
where table_name = 'households'
  and row_id = '<uuid>'
order by at;
```

## Restore a hard-deleted row

Use the latest `delete` row’s `old_row`. Column lists must match the live table — cast jsonb fields as needed.

```sql
-- Example: restore one household from its delete snapshot
insert into public.households
select (jsonb_populate_record(null::public.households, s.old_row)).*
from (
  select old_row
  from public.change_log
  where table_name = 'households'
    and row_id = '<uuid>'
    and action = 'delete'
  order by at desc
  limit 1
) s
on conflict (id) do nothing;
```

Also restore related rows from the same moment if needed (`people`, `household_categories`, `contact_visits`, …) the same way, filtering `change_log` by `table_name` and matching foreign keys inside `old_row`.

## Revert an update

Put `old_row` back over the live row:

```sql
update public.households h
set
  name = s.old_row->>'name',
  street = s.old_row->>'street',
  city = s.old_row->>'city',
  state = s.old_row->>'state',
  zip = s.old_row->>'zip',
  notes = s.old_row->>'notes',
  -- …set any other columns you need from old_row
  updated_at = now()  -- only if the column exists
from (
  select old_row
  from public.change_log
  where table_name = 'households'
    and row_id = '<uuid>'
    and action = 'update'
  order by at desc
  limit 1
) s
where h.id = '<uuid>';
```

Or replace the whole row from jsonb when types line up:

```sql
delete from public.households where id = '<uuid>';
insert into public.households
select * from jsonb_populate_record(
  null::public.households,
  (
    select old_row
    from public.change_log
    where table_name = 'households' and row_id = '<uuid>' and action = 'update'
    order by at desc
    limit 1
  )
);
```

## Soft-hide (shliach) vs hard delete

- Soft-hide sets `deleted_by_shliach_at` / `deleted_by_shliach_by` (logged as an **update**). Clear those columns or restore from that update’s `old_row`.
- Hard delete removes the row (logged as **delete** with full `old_row`). Use the restore-insert pattern above.

## Platform backups

Supabase project `pahrtdszegtowrfknqtf` also has WAL-G physical backups enabled (`walg_enabled: true`). Point-in-time recovery (PITR) was **not** enabled when this was written — enabling PITR is a billing change; do not turn it on without Mendel’s say-so. Daily/physical backup listings may be empty on the free/pro default plan even when WALG is on; the app-level `change_log` is the restore path for “someone deleted a contact.”
