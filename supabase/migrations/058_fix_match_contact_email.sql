-- match_contact_address failed for every email lookup: the variable "email" clashed with people.email
-- ("column reference email is ambiguous"), and the error was swallowed, so no email sender ever matched a
-- contact. Rename the variables, skip deleted contacts, and prefer live ones.
create or replace function public.match_contact_address(p_key text, p_org uuid, p_family text, p_address text)
returns table(org_id uuid, household_id uuid, person_id uuid, name text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_address));
  v_digits text := regexp_replace(p_address, '\D', '', 'g');
  v_last10 text;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  if length(v_digits) > 10 then v_last10 := right(v_digits, 10); else v_last10 := v_digits; end if;
  if p_family = 'email' then
    return query
      select h.org_id, pe.household_id, pe.id, pe.name
        from public.people pe join public.households h on h.id = pe.household_id
       where lower(pe.email) = v_email and (p_org is null or h.org_id = p_org)
       order by (h.deleted_at is null and h.deleted_by_shliach_at is null) desc, pe.sort_order
       limit 1;
    return;
  end if;
  return query
    select h.org_id, pe.household_id, pe.id, pe.name
      from public.people pe join public.households h on h.id = pe.household_id
     where (p_org is null or h.org_id = p_org)
       and (
         right(regexp_replace(coalesce(pe.phone, ''), '\D', '', 'g'), 10) = v_last10
         or right(regexp_replace(coalesce(pe.phone2, ''), '\D', '', 'g'), 10) = v_last10
         or right(regexp_replace(coalesce(pe.phone3, ''), '\D', '', 'g'), 10) = v_last10
         or right(regexp_replace(coalesce(pe.whatsapp, ''), '\D', '', 'g'), 10) = v_last10
         or exists (select 1 from unnest(coalesce(pe.extra_phones, '{}'::text[])) x where right(regexp_replace(x, '\D', '', 'g'), 10) = v_last10)
       )
     order by (h.deleted_at is null and h.deleted_by_shliach_at is null) desc, pe.sort_order
     limit 1;
end;
$$;

create or replace function public.gmail_known_ids(p_key text, p_ids text[]) returns boolean language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.messaging_key_ok(p_key) then raise exception 'Ingest is not authorized.' using errcode='42501'; end if;
  return exists(select 1 from public.message_messages where provider='gmail' and provider_message_id = any(p_ids))
      or exists(select 1 from public.message_unmatched where provider='gmail' and provider_message_id = any(p_ids));
end $$;
revoke all on function public.gmail_known_ids(text,text[]) from public;
grant execute on function public.gmail_known_ids(text,text[]) to anon, authenticated;

-- Which of these Gmail message ids are already stored (as a conversation message or an unknown sender)?
drop function if exists public.gmail_known_ids(text, text[]);
create or replace function public.gmail_known_ids(p_key text, p_ids text[]) returns text[] language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.messaging_key_ok(p_key) then raise exception 'Ingest is not authorized.' using errcode='42501'; end if;
  return coalesce((
    select array_agg(distinct x) from (
      select provider_message_id as x from public.message_messages where provider = 'gmail' and provider_message_id = any(p_ids)
      union
      select provider_message_id from public.message_unmatched where provider = 'gmail' and provider_message_id = any(p_ids)
    ) s
  ), '{}'::text[]);
end $$;
revoke all on function public.gmail_known_ids(text, text[]) from public;
grant execute on function public.gmail_known_ids(text, text[]) to anon, authenticated;
