-- Global search across everything saved on a contact. Runs as the caller, so
-- row-level security (state / ownership scoping) and the masked people view apply.
create extension if not exists pg_trgm;

create index if not exists households_name_trgm on public.households using gin (lower(name) gin_trgm_ops);
create index if not exists households_street_trgm on public.households using gin (lower(street) gin_trgm_ops);
create index if not exists households_city_trgm on public.households using gin (lower(city) gin_trgm_ops);
create index if not exists households_notes_trgm on public.households using gin (lower(notes) gin_trgm_ops);
create index if not exists people_name_trgm on public.people using gin (lower(name) gin_trgm_ops);
create index if not exists people_email_trgm on public.people using gin (lower(email) gin_trgm_ops);
create index if not exists contact_visits_notes_trgm on public.contact_visits using gin (lower(notes) gin_trgm_ops);

create or replace function public.search_contacts(p_q text, p_limit integer default 12)
returns table (household_id uuid, name text, city text, state text, field text, value text)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select
      '%' || replace(replace(replace(lower(trim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
      regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits,
      length(trim(coalesce(p_q, ''))) as n
  ),
  hh as (
    select h.* from public.households h
    where h.deleted_at is null and h.deleted_by_shliach_at is null
  ),
  cand as (
    select h.id, 1 as r, 'Name' as f, h.name as v from hh h, q where q.n >= 2 and lower(h.name) like q.pat
    union all
    select h.id, 2, 'Address', concat_ws(', ', nullif(h.street, ''), nullif(h.city, ''), nullif(h.state, ''), nullif(h.zip, ''))
      from hh h, q where q.n >= 2 and lower(concat_ws(', ', h.street, h.city, h.state, h.zip)) like q.pat
    union all
    select h.id, 2, 'Address', concat_ws(', ', nullif(h.street, ''), nullif(h.city, ''), nullif(h.state, ''), nullif(h.zip, ''))
      from hh h, q where q.n >= 2 and lower(concat_ws(' ', h.street, h.city, h.state, h.zip)) like q.pat
    union all
    select h.id, 3, 'Other address', h.extra_addresses::text from hh h, q where q.n >= 2 and lower(h.extra_addresses::text) like q.pat and h.extra_addresses::text <> '[]'
    union all
    select h.id, 4, 'Member', pe.name from hh h join public.people_visible pe on pe.household_id = h.id, q where q.n >= 2 and lower(pe.name) like q.pat
    union all
    select h.id, 5, 'Phone', coalesce(nullif(pe.phone, ''), nullif(pe.phone2, ''), nullif(pe.phone3, ''), pe.whatsapp)
      from hh h join public.people_visible pe on pe.household_id = h.id, q
      where length(q.digits) >= 3 and (
        regexp_replace(coalesce(pe.phone, ''), '\D', '', 'g') like '%' || q.digits || '%'
        or regexp_replace(coalesce(pe.phone2, ''), '\D', '', 'g') like '%' || q.digits || '%'
        or regexp_replace(coalesce(pe.phone3, ''), '\D', '', 'g') like '%' || q.digits || '%'
        or regexp_replace(coalesce(pe.whatsapp, ''), '\D', '', 'g') like '%' || q.digits || '%')
    union all
    select h.id, 6, 'Email', pe.email from hh h join public.people_visible pe on pe.household_id = h.id, q where q.n >= 2 and lower(pe.email) like q.pat
    union all
    select h.id, 7, 'Project', pr.name from hh h join public.projects pr on pr.id = h.project_id, q where q.n >= 2 and lower(pr.name) like q.pat
    union all
    select h.id, 8, 'Tag', array_to_string(h.tags, ', ') from hh h, q where q.n >= 2 and lower(array_to_string(h.tags, ' ')) like q.pat
    union all
    select h.id, 9, 'Notes', h.notes from hh h, q where q.n >= 2 and lower(h.notes) like q.pat
    union all
    select h.id, 10, 'Visit notes', coalesce(nullif(cv.notes, ''), nullif(cv.visited, ''), 'Reaction: ' || replace(coalesce(cv.reaction, ''), '_', ' ')) from hh h join public.contact_visits cv on cv.household_id = h.id and cv.deleted_at is null, q
      where q.n >= 2 and public.can_view_history() and (lower(cv.notes) like q.pat or lower(coalesce(cv.visited, '')) like q.pat or lower(coalesce(cv.reaction, '')) like q.pat or lower(replace(coalesce(cv.reaction, ''), '_', ' ')) like q.pat)
    union all
    select h.id, 10, 'Visit notes', coalesce(nullif(v.details, ''), 'Reaction: ' || coalesce(v.reaction::text, '')) from hh h join public.visits v on v.household_id = h.id, q
      where q.n >= 2 and public.can_view_history() and (lower(v.details) like q.pat or lower(coalesce(v.reaction::text, '')) like q.pat)
    union all
    select h.id, 11, 'Details', h.custom_fields::text from hh h, q where q.n >= 2 and lower(h.custom_fields::text) like q.pat and h.custom_fields::text <> '{}'
    union all
    select h.id, 12, 'Pre-planner note', pp.notes from hh h join public.preplanner_entries pp on pp.household_id = h.id, q where q.n >= 2 and lower(pp.notes) like q.pat
  ),
  best as (
    select distinct on (id) id, r, f, v from cand order by id, r
  )
  select h.id, h.name, h.city, h.state, b.f, left(b.v, 160)
  from best b join hh h on h.id = b.id
  order by b.r, h.name
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

grant execute on function public.search_contacts(text, integer) to authenticated;
