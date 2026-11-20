-- ingest_inbound_message referenced its own parameter by function name (ingest_inbound_message.provider), which
-- fails with 'missing FROM-clause entry', so every inbound message with a provider id failed to save. It also
-- inserted reached_time as text into a time column when starting a Reached out row.
CREATE OR REPLACE FUNCTION public.ingest_inbound_message(p_key text, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  org uuid;
  hid uuid;
  pid uuid;
  typ text;
  addr text;
  body text;
  subj text;
  v_provider text;
  mid text;
  cid uuid;
  project uuid;
  tid uuid;
  msg uuid;
  existing uuid;
  note text;
  how text;
begin
  if not public.messaging_key_ok(p_key) then
    raise exception 'Ingest is not authorized.' using errcode = '42501';
  end if;

  typ := coalesce(payload->>'channel_type', '');
  addr := lower(trim(coalesce(payload->>'contact_address', '')));
  body := coalesce(payload->>'body', '');
  subj := nullif(payload->>'subject', '');
  v_provider := nullif(payload->>'provider', '');
  mid := nullif(payload->>'provider_message_id', '');
  begin
    cid := nullif(payload->>'channel_id', '')::uuid;
  exception when others then
    cid := null;
  end;
  begin
    org := nullif(payload->>'org_id', '')::uuid;
  exception when others then
    org := null;
  end;
  begin
    hid := nullif(payload->>'household_id', '')::uuid;
  exception when others then
    hid := null;
  end;
  begin
    pid := nullif(payload->>'person_id', '')::uuid;
  exception when others then
    pid := null;
  end;
  begin
    project := nullif(payload->>'project_id', '')::uuid;
  exception when others then
    project := null;
  end;

  if typ not in ('email_gmail', 'email_resend', 'sms_twilio', 'whatsapp_twilio', 'email', 'sms', 'whatsapp') then
    raise exception 'Unknown channel type.' using errcode = '22023';
  end if;
  if addr = '' then
    raise exception 'A contact address is required.' using errcode = '22023';
  end if;

  if mid is not null and v_provider is not null then
    select id into existing
      from public.message_messages
     where message_messages.provider = v_provider
       and provider_message_id = mid
     limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  if hid is null then
    raise exception 'No matching contact.' using errcode = 'P0002';
  end if;
  if org is null then
    select org_id into org from public.households where id = hid;
  end if;

  select id into tid
    from public.message_threads
   where org_id = org
     and household_id = hid
     and channel_type = typ
     and lower(contact_address) = addr
   limit 1;

  if tid is null then
    insert into public.message_threads (
      org_id, household_id, person_id, channel_id, channel_type, contact_address, project_id,
      last_at, last_preview, last_direction, unread_count, last_inbound_at
    ) values (
      org, hid, pid, cid, typ, addr, project,
      now(), left(body, 180), 'in', 1, now()
    )
    returning id into tid;
  else
    update public.message_threads
       set last_at = now(),
           last_preview = left(body, 180),
           last_direction = 'in',
           unread_count = coalesce(unread_count, 0) + 1,
           last_inbound_at = now(),
           person_id = coalesce(message_threads.person_id, pid),
           channel_id = coalesce(message_threads.channel_id, cid),
           project_id = coalesce(message_threads.project_id, project)
     where id = tid;
  end if;

  insert into public.message_messages (
    thread_id, org_id, household_id, person_id, channel_id, channel_type,
    direction, body, subject, status, provider, provider_message_id
  ) values (
    tid, org, hid, pid, cid, typ,
    'in', body, subj, 'received', v_provider, mid
  )
  returning id into msg;

  how := case
    when typ in ('email_gmail', 'email_resend', 'email') then 'email'
    when typ in ('whatsapp_twilio', 'whatsapp') then 'whatsapp'
    else 'text'
  end;
  note := case when subj is not null and subj <> '' then subj || E'\n' || body else body end;

  -- Attach to the latest open Pre-planner entry, or start a Reached out row.
  if exists (
    select 1 from public.preplanner_entries e
     where e.household_id = hid and e.org_id = org
  ) then
    update public.preplanner_entries e
       set replied_at = now(),
           notes_log = coalesce(e.notes_log, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object('at', now(), 'text', note, 'by', 'Reply')
           ),
           notes = case when coalesce(e.notes, '') = '' then note else e.notes || E'\n\n' || note end,
           reached_hows = case
             when how = any(coalesce(e.reached_hows, '{}')) then e.reached_hows
             else coalesce(e.reached_hows, '{}') || array[how]
           end,
           updated_at = now()
     where e.id = (
       select e2.id from public.preplanner_entries e2
        where e2.household_id = hid and e2.org_id = org
        order by (e2.stage = 'reached_out') desc, e2.created_at desc
        limit 1
     );
  else
    insert into public.preplanner_entries (
      org_id, household_id, stage, reached_date, reached_time, reached_how, reached_hows,
      follow_up_how, notes, notes_log, project_id, replied_at
    ) values (
      org, hid, 'reached_out', (now() at time zone 'America/New_York')::date,
      date_trunc('minute', now() at time zone 'America/New_York')::time,
      how, array[how], how, note,
      jsonb_build_array(jsonb_build_object('at', now(), 'text', note, 'by', 'Reply')),
      project, now()
    );
  end if;

  return msg;
end;
$function$
;
