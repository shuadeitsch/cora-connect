-- 1.8.56: what-happened activities on the visits log table (contact_visits already has them).
alter table public.visits
  add column if not exists activities text[] not null default '{}';

comment on column public.visits.activities is
  'What happened on the visit: built-in chips and Other write-ins.';
