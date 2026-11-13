-- 1.8.64: multiple reach-out channels on a Pre-planner entry, and a per-user sidebar order.
alter table public.preplanner_entries
  add column if not exists reached_hows text[] not null default '{}';

update public.preplanner_entries
   set reached_hows = array[reached_how]
 where coalesce(cardinality(reached_hows), 0) = 0
   and reached_how is not null
   and reached_how <> '';

alter table public.preplanner_entries
  drop constraint if exists preplanner_reached_hows_check;

alter table public.preplanner_entries
  add constraint preplanner_reached_hows_check check (
    cardinality(reached_hows) >= 1
    and reached_hows <@ array['email', 'text', 'whatsapp', 'phone', 'in_person', 'other']::text[]
  );

comment on column public.preplanner_entries.reached_hows is
  'How this contact was reached; one or more of email, text, whatsapp, phone, in_person, other. reached_how stays the first value.';

create or replace function public.preplanner_sync_reached_hows()
returns trigger
language plpgsql
as $$
begin
  if new.reached_hows is not null and cardinality(new.reached_hows) >= 1 then
    new.reached_how := new.reached_hows[1];
  elsif new.reached_how is not null and new.reached_how <> '' then
    new.reached_hows := array[new.reached_how];
  end if;
  return new;
end;
$$;

drop trigger if exists preplanner_sync_reached_hows on public.preplanner_entries;
create trigger preplanner_sync_reached_hows
  before insert or update on public.preplanner_entries
  for each row execute function public.preplanner_sync_reached_hows();

alter table public.profiles
  add column if not exists sidebar_order text[];

comment on column public.profiles.sidebar_order is
  'Optional custom sidebar href order for this user. Null means the default (Pre-planner above Routes).';
