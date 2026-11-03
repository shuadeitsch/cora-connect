-- Daily planner: optional address on an event. Adds one column to the planner's own table only.
alter table public.planner_items add column if not exists address text not null default '';
