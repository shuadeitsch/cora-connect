-- Rewrite recognizable contact tags to the two official labels.
-- A tag that is not one of those labels is left as stored. Notes are not changed.
-- Safe to run again.

create function pg_temp.fold_contact_tag(raw text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      replace(replace(replace(replace(replace(replace(lower(btrim(coalesce(raw, ''))),
        chr(8217), ''),
        chr(8216), ''),
        chr(8218), ''),
        chr(8219), ''),
        '`', ''),
        '''', ''),
      '[^a-z0-9]+',
      ' ',
      'g'
    ),
    ' +',
    ' ',
    'g'
  ));
$$;

create function pg_temp.canonical_contact_tag(raw text)
returns text
language sql
immutable
as $$
  select case
    when folded in ('not jewish', 'non jewish') then 'Not Jewish'
    when folded in (
      'probably doesnt exist',
      'probably does not exist',
      'probably dosent exist',
      'probably doesent exist',
      'probobly doesnt exist',
      'probobly does not exist',
      'probobly dosent exist',
      'probobly doesent exist',
      'propably doesnt exist',
      'probably doesnt exists',
      'probably does not exists'
    ) then 'Probably doesn''t exist'
    else btrim(raw)
  end
  from (select pg_temp.fold_contact_tag(raw) as folded) folded;
$$;

update public.households h
set tags = mapped.tags
from (
  select
    source.id,
    coalesce(array_agg(distinct pg_temp.canonical_contact_tag(tag) order by pg_temp.canonical_contact_tag(tag)), '{}') as tags
  from public.households source
  cross join lateral unnest(coalesce(source.tags, '{}')) as tag
  where btrim(tag) <> ''
  group by source.id
) mapped
where h.id = mapped.id
  and h.tags is distinct from mapped.tags;
