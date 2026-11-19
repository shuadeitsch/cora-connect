-- Replies from a different address than the one we emailed (a personal address, an alias, a forward)
-- used to be dropped because contacts were matched only by the sender's address. Match them by Gmail
-- thread instead: a reply shares the Gmail thread id with the message we sent (our sent message's
-- provider_message_id is its Gmail id, which is the thread id for the first message in a thread).
create or replace function public.match_gmail_reply(p_key text, p_ids text[])
returns table(org_id uuid, household_id uuid, person_id uuid, contact_address text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  return query
    select m.org_id, m.household_id, coalesce(m.person_id, t.person_id), t.contact_address
      from public.message_messages m
      join public.message_threads t on t.id = m.thread_id
     where m.provider = 'gmail'
       and m.direction = 'out'
       and m.provider_message_id = any(p_ids)
     order by m.created_at desc
     limit 1;
end;
$$;

revoke all on function public.match_gmail_reply(text, text[]) from public;
grant execute on function public.match_gmail_reply(text, text[]) to anon, authenticated;
