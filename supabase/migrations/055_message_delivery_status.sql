-- Real delivery outcome for sent messages: Twilio status callbacks update the log row.
alter table public.message_messages drop constraint if exists message_messages_status_check;
alter table public.message_messages add constraint message_messages_status_check
  check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'received'));

-- Only moves a message forward (sent -> delivered -> read) or to failed; never downgrades a delivered/read one.
create or replace function public.update_message_status(p_key text, p_provider_id text, p_status text, p_error text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
  next_status text := case lower(coalesce(p_status, ''))
    when 'queued' then 'queued' when 'accepted' then 'queued' when 'scheduled' then 'queued' when 'sending' then 'queued'
    when 'sent' then 'sent' when 'delivered' then 'delivered' when 'read' then 'read'
    when 'failed' then 'failed' when 'undelivered' then 'failed'
    else null end;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;
  if next_status is null or coalesce(p_provider_id, '') = '' then
    return 0;
  end if;
  update public.message_messages m
     set status = next_status,
         error = case when next_status = 'failed' then nullif(p_error, '') else null end
   where m.provider = 'twilio'
     and m.provider_message_id = p_provider_id
     and m.direction = 'out'
     and (
       case m.status when 'queued' then 0 when 'sent' then 1 when 'failed' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end
     ) < (
       case next_status when 'queued' then 0 when 'sent' then 1 when 'failed' then 2 when 'delivered' then 3 when 'read' then 4 end
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.update_message_status(text, text, text, text) from public;
grant execute on function public.update_message_status(text, text, text, text) to anon, authenticated;
