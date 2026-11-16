-- Prefer a channel of the requested type so WhatsApp inbound is not attached to the SMS row that shares the same number.

create or replace function public.lookup_messaging_channel(p_key text, p_address text, p_type text default null)
returns table (id uuid, org_id uuid, type text, address text, owner_user_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  digits text := right(regexp_replace(coalesce(p_address, ''), '\D', '', 'g'), 10);
  email text := lower(trim(regexp_replace(coalesce(p_address, ''), '^whatsapp:', '')));
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  return query
    select c.id, c.org_id, c.type, c.address, c.owner_user_id
      from public.outreach_channels c
     where c.status = 'active'
       and (
         p_type is null
         or c.type = p_type
       )
       and (
         lower(c.address) = email
         or lower(replace(c.address, 'whatsapp:', '')) = email
         or (digits <> '' and right(regexp_replace(c.address, '\D', '', 'g'), 10) = digits)
       )
     order by (c.type = coalesce(p_type, c.type)) desc, c.created_at desc
     limit 1;
end;
$$;

revoke all on function public.lookup_messaging_channel(text, text) from public;
revoke all on function public.lookup_messaging_channel(text, text, text) from public;
grant execute on function public.lookup_messaging_channel(text, text) to anon, authenticated;
grant execute on function public.lookup_messaging_channel(text, text, text) to anon, authenticated;
