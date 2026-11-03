-- Restore table-level privileges on the visit log and people.
-- Safe to run again. Does not edit earlier migrations.
--
-- authenticated could INSERT, UPDATE, and DELETE public.visits and
-- public.people, but table SELECT had been revoked (001 grants SELECT
-- only on some columns). PostgREST then reported
-- "permission denied for table visits" when a write returned the row.
-- This is the grant already applied on production.

grant select, insert, update, delete on public.visits to authenticated;
grant select, insert, update, delete on public.people to authenticated;
