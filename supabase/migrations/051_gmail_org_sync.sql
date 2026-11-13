-- 1.8.66: authenticated org-scoped Gmail history sync (no ingest key required to list accounts).
create or replace function public.gmail_sync_org_accounts()
returns table (
  id uuid,
  org_id uuid,
  user_id uuid,
  email text,
  refresh_token_cipher text,
  refresh_token_iv text,
  history_id text,
  can_read boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.access_open() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
    select a.id, a.org_id, a.user_id, a.email, a.refresh_token_cipher, a.refresh_token_iv, a.history_id, a.can_read
      from public.outreach_gmail_accounts a
     where a.org_id = public.my_org_id()
       and a.can_read = true;
end;
$$;

revoke all on function public.gmail_sync_org_accounts() from public, anon;
grant execute on function public.gmail_sync_org_accounts() to authenticated;

create or replace function public.gmail_save_history_org(p_account uuid, p_history_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.access_open() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.outreach_gmail_accounts
     set history_id = p_history_id, last_used_at = now()
   where id = p_account
     and org_id = public.my_org_id();
end;
$$;

revoke all on function public.gmail_save_history_org(uuid, text) from public, anon;
grant execute on function public.gmail_save_history_org(uuid, text) to authenticated;
