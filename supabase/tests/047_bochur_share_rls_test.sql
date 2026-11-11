-- Rolled-back RLS test: a contact a shliach shares is visible to his bochur in that state.
-- Probe emails: cora-share-test-*@invalid.cora  — never commit this transaction.

create temporary table if not exists cora_share_test_result (ok boolean, detail text);

do $test$
declare
  org uuid := 'c0a00000-0000-4000-8000-000000000001';
  s1 uuid := 'a5555555-c0a0-4111-8111-111111111111';
  b1 uuid := 'b5555555-c0a0-4111-8111-111111111111';
  h_shared uuid := 'c5555555-c0a0-4111-8111-111111111111';
  h_hidden uuid := 'c6666666-c0a0-4111-8111-111111111111';
  h_other uuid := 'c7777777-c0a0-4111-8111-111111111111';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values
    ('00000000-0000-0000-0000-000000000000', s1, 'authenticated', 'authenticated', 'cora-share-test-s1@invalid.cora', '', now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', b1, 'authenticated', 'authenticated', 'cora-share-test-b1@invalid.cora', '', now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  insert into public.profiles (id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit, leader_id)
  values
    (s1, org, 'Share Test Shliach', 'cora-share-test-s1@invalid.cora', 'shliach', 'approved', null, true, true, true, null),
    (b1, org, 'Share Test Bochur', 'cora-share-test-b1@invalid.cora', 'bochur', 'approved', null, true, true, false, s1);

  insert into public.territories (user_id, state, area) values (s1, 'ME', '');

  insert into public.households (id, org_id, name, city, state, owner_id, shared_with_cora)
  values
    (h_shared, org, 'Cora share test shared', 'Portland', 'ME', s1, true),
    (h_hidden, org, 'Cora share test hidden', 'Portland', 'ME', s1, true),
    (h_other,  org, 'Cora share test other state', 'Madison', 'WI', s1, true);

  -- Shliach shares only h_shared (and mistakenly also the out-of-state contact).
  perform set_config('request.jwt.claim.sub', s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', s1::text, 'role', 'authenticated')::text, true);
  if public.share_contact_with_all_bochurim(h_shared, true) < 1 then
    raise exception 'share test: shliach could not share the ME contact';
  end if;
  perform public.share_contact_with_all_bochurim(h_other, true);

  -- Helper: bochur sees the shared in-state contact, not the unshared one, not the out-of-state one.
  perform set_config('request.jwt.claim.sub', b1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b1::text, 'role', 'authenticated')::text, true);
  if not public.can_see_household(h_shared) then
    raise exception 'share test: bochur cannot see the shared ME contact';
  end if;
  if public.can_see_household(h_hidden) then
    raise exception 'share test: bochur saw the unshared ME contact';
  end if;
  if public.can_see_household(h_other) then
    raise exception 'share test: bochur saw the shared out-of-state contact';
  end if;

  insert into cora_share_test_result values (true, 'ok');
end;
$test$;

-- True RLS table scans as the bochur.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5555555-c0a0-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"b5555555-c0a0-4111-8111-111111111111","role":"authenticated"}', true);

do $rls$
begin
  if not exists (select 1 from public.households where id = 'c5555555-c0a0-4111-8111-111111111111') then
    raise exception 'share test: RLS bochur missed the shared ME contact';
  end if;
  if exists (select 1 from public.households where id = 'c6666666-c0a0-4111-8111-111111111111') then
    raise exception 'share test: RLS bochur saw the unshared ME contact';
  end if;
  if exists (select 1 from public.households where id = 'c7777777-c0a0-4111-8111-111111111111') then
    raise exception 'share test: RLS bochur saw the shared out-of-state contact';
  end if;
end;
$rls$;

reset role;
select * from cora_share_test_result;
