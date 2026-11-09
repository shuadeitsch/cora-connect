-- 1.8.34: free-text "Visited by" on contact history (does not overwrite notes).
alter table public.contact_visits
  add column if not exists visited_by text;

comment on column public.contact_visits.visited_by is 'Display names of who visited (e.g. Mendel Baitelman & Mendele Lustig). Separate from notes.';

-- Also keep visits.visitor_name available for the reports log when used.
