-- Rolled-back RLS tests for 039_chavrusos. Never commit this. No leftover rows.
-- Probe emails: cora-chavrusa-test-*@invalid.cora
-- Probe planner dates: 2099-01-15 / 2099-01-16 (not Mendel's real days).

create temporary table if not exists cora_chavrusa_test_result (ok boolean, detail text);

do $test$
declare
  org uuid := 'c0a00000-0000-4000-8000-000000000001';
  s1 uuid := 'a1111111-c0a0-4111-8111-111111111111';
  s2 uuid := 'a2222222-c0a0-4111-8111-111111111111';
  ba uuid := 'b1111111-c0a0-4111-8111-111111111111';
  bb uuid := 'b2222222-c0a0-4111-8111-111111111111';
  bu uuid := 'b3333333-c0a0-4111-8111-111111111111';
  bx uuid := 'b4444444-c0a0-4111-8111-111111111111';
  adm uuid;
  day_shared uuid := 'd1111111-c0a0-4111-8111-111111111111';
  day_a uuid := 'd2222222-c0a0-4111-8111-111111111111';
  day_b uuid := 'd3333333-c0a0-4111-8111-111111111111';
  day_hidden uuid := 'd4444444-c0a0-4111-8111-111111111111';
  seen int;
  got text;
  err text;
begin
  select id into adm from public.profiles where role = 'admin' and status = 'approved' limit 1;
  if adm is null then
    raise exception 'chavrusa test: no admin profile';
  end if;

  -- Bypass invitation trigger; test users never persist (outer transaction rolls back).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values
    ('00000000-0000-0000-0000-000000000000', s1, 'authenticated', 'authenticated', 'cora-chavrusa-test-s1@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s2, 'authenticated', 'authenticated', 'cora-chavrusa-test-s2@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', ba, 'authenticated', 'authenticated', 'cora-chavrusa-test-ba@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', bb, 'authenticated', 'authenticated', 'cora-chavrusa-test-bb@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', bu, 'authenticated', 'authenticated', 'cora-chavrusa-test-bu@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', bx, 'authenticated', 'authenticated', 'cora-chavrusa-test-bx@invalid.cora', crypt('x', gen_salt('bf')), now(), '{"seed":"true"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  insert into public.profiles (id, org_id, name, email, role, status, expires_at, can_view_history, can_view_contact, can_edit, leader_id)
  values
    (s1, org, 'Test Shliach 1', 'cora-chavrusa-test-s1@invalid.cora', 'shliach', 'approved', null, true, true, true, null),
    (s2, org, 'Test Shliach 2', 'cora-chavrusa-test-s2@invalid.cora', 'shliach', 'approved', null, true, true, true, null),
    (ba, org, 'Test Bochur A', 'cora-chavrusa-test-ba@invalid.cora', 'bochur', 'approved', null, true, true, false, s1),
    (bb, org, 'Test Bochur B', 'cora-chavrusa-test-bb@invalid.cora', 'bochur', 'approved', null, true, true, false, s1),
    (bu, org, 'Test Bochur U', 'cora-chavrusa-test-bu@invalid.cora', 'bochur', 'approved', null, true, true, false, s1),
    (bx, org, 'Test Bochur X', 'cora-chavrusa-test-bx@invalid.cora', 'bochur', 'approved', null, true, true, false, s2);

  insert into public.planner_days (id, org_id, date, created_by, visible_to_bochurim, editable_by_bochurim, chavrusa)
  values
    (day_shared, org, '2099-01-15', s1, true, true, null),
    (day_a,      org, '2099-01-15', s1, true, true, 'A'),
    (day_b,      org, '2099-01-15', s1, true, true, 'B'),
    (day_hidden, org, '2099-01-16', s1, false, true, 'A');

  -- Unique key: a second shared day on the same date must fail.
  begin
    insert into public.planner_days (org_id, date, created_by, chavrusa)
    values (org, '2099-01-15', s1, null);
    raise exception 'chavrusa test: expected unique shared day to fail';
  exception
    when unique_violation then null;
  end;

  -- Shliach S1 can assign his bochurim.
  perform set_config('request.jwt.claim.sub', s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', s1::text, 'role', 'authenticated')::text, true);
  got := public.set_bochur_chavrusa(ba, 'A');
  if got is distinct from 'A' then raise exception 'chavrusa test: S1 could not set A'; end if;
  got := public.set_bochur_chavrusa(bb, 'B');
  if got is distinct from 'B' then raise exception 'chavrusa test: S1 could not set B'; end if;

  -- S1 cannot assign S2's bochur.
  begin
    perform public.set_bochur_chavrusa(bx, 'A');
    raise exception 'chavrusa test: S1 assigned S2 bochur';
  exception
    when others then
      if sqlerrm not like '%own bochurim%' then raise; end if;
  end;

  -- Bochur cannot assign himself via a direct profile update (trigger lock).
  perform set_config('request.jwt.claim.sub', ba::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ba::text, 'role', 'authenticated')::text, true);
  update public.profiles set chavrusa = 'B' where id = ba;
  if (select chavrusa from public.profiles where id = ba) is distinct from 'A' then
    raise exception 'chavrusa test: bochur changed his own chavrusa';
  end if;
  begin
    perform public.set_bochur_chavrusa(ba, 'B');
    raise exception 'chavrusa test: bochur RPC set his own chavrusa';
  exception
    when others then
      if sqlerrm not like '%own bochurim%' then raise; end if;
  end;

  -- Admin can assign.
  perform set_config('request.jwt.claim.sub', adm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', adm::text, 'role', 'authenticated')::text, true);
  got := public.set_bochur_chavrusa(bu, 'A');
  if got is distinct from 'A' then raise exception 'chavrusa test: admin could not assign'; end if;
  got := public.set_bochur_chavrusa(bu, null);
  if got is not null then raise exception 'chavrusa test: admin could not clear'; end if;

  -- Confirm the four probe days landed (table owner bypasses RLS here).
  select count(*) into seen from public.planner_days where date in ('2099-01-15', '2099-01-16');
  if seen <> 4 then raise exception 'chavrusa test: setup inserted % probe days, expected 4', seen; end if;

  -- Helpers encode the same rules as the policies (security definer, keyed off jwt).
  perform set_config('request.jwt.claim.sub', ba::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ba::text, 'role', 'authenticated')::text, true);
  if public.my_chavrusa() is distinct from 'A' then raise exception 'chavrusa test: my_chavrusa A'; end if;
  if not public.planner_day_visible_to_me(day_shared) or not public.planner_day_visible_to_me(day_a) then
    raise exception 'chavrusa test: helpers should show shared+A to bochur A';
  end if;
  if public.planner_day_visible_to_me(day_b) or public.planner_day_visible_to_me(day_hidden) then
    raise exception 'chavrusa test: helpers leaked B or hidden to bochur A';
  end if;
  if not public.planner_day_editable_by_me(day_shared) or not public.planner_day_editable_by_me(day_a) then
    raise exception 'chavrusa test: bochur A should be able to edit shared+A';
  end if;
  if public.planner_day_editable_by_me(day_b) then
    raise exception 'chavrusa test: bochur A could edit B';
  end if;

  -- Bochur A cannot retag a day.
  begin
    update public.planner_days set chavrusa = 'B' where id = day_a;
    raise exception 'chavrusa test: bochur A retagged a day';
  exception
    when others then
      if sqlerrm not like '%cannot change which chavrusa%' and sqlerrm not like '%row-level security%' then
        raise;
      end if;
  end;

  -- Bochur B helpers: shared + B, not A, not hidden.
  perform set_config('request.jwt.claim.sub', bb::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', bb::text, 'role', 'authenticated')::text, true);
  if public.my_chavrusa() is distinct from 'B' then raise exception 'chavrusa test: my_chavrusa B'; end if;
  if not public.planner_day_visible_to_me(day_shared) or not public.planner_day_visible_to_me(day_b) then
    raise exception 'chavrusa test: helpers should show shared+B to bochur B';
  end if;
  if public.planner_day_visible_to_me(day_a) or public.planner_day_visible_to_me(day_hidden) then
    raise exception 'chavrusa test: helpers leaked A or hidden to bochur B';
  end if;

  -- Unassigned bochur sees only shared.
  perform set_config('request.jwt.claim.sub', bu::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', bu::text, 'role', 'authenticated')::text, true);
  if public.my_chavrusa() is not null then raise exception 'chavrusa test: unassigned my_chavrusa'; end if;
  if not public.planner_day_visible_to_me(day_shared) then
    raise exception 'chavrusa test: unassigned missed shared day';
  end if;
  if public.planner_day_visible_to_me(day_a) or public.planner_day_visible_to_me(day_b) then
    raise exception 'chavrusa test: unassigned saw A or B';
  end if;

  -- Shliach helpers see every test day (including hidden).
  perform set_config('request.jwt.claim.sub', s1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', s1::text, 'role', 'authenticated')::text, true);
  if not public.planner_day_visible_to_me(day_shared)
     or not public.planner_day_visible_to_me(day_a)
     or not public.planner_day_visible_to_me(day_b)
     or not public.planner_day_visible_to_me(day_hidden) then
    raise exception 'chavrusa test: shliach helper missed a day';
  end if;

  -- Reset role so cleanup (if any) is unhindered; outer rollback drops everything.
  perform set_config('role', 'postgres', true);

  insert into cora_chavrusa_test_result values (true, 'ok');
end;
$test$;


-- True RLS table scans: switch to authenticated in this transaction (not inside a function).
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-c0a0-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"b1111111-c0a0-4111-8111-111111111111","role":"authenticated"}', true);
do $rls_a$
declare seen int;
begin
  select count(*) into seen from public.planner_days where date in ('2099-01-15', '2099-01-16');
  if seen <> 2 then
    raise exception 'chavrusa test: RLS bochur A saw % days, expected 2 (shared+A)', seen;
  end if;
  if exists (select 1 from public.planner_days where id = 'd3333333-c0a0-4111-8111-111111111111') then
    raise exception 'chavrusa test: RLS bochur A saw chavrusa B day';
  end if;
  if exists (select 1 from public.planner_days where id = 'd4444444-c0a0-4111-8111-111111111111') then
    raise exception 'chavrusa test: RLS bochur A saw hidden A day';
  end if;
end;
$rls_a$;

select set_config('request.jwt.claim.sub', 'b2222222-c0a0-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"b2222222-c0a0-4111-8111-111111111111","role":"authenticated"}', true);
do $rls_b$
declare seen int;
begin
  select count(*) into seen from public.planner_days where date in ('2099-01-15', '2099-01-16');
  if seen <> 2 then
    raise exception 'chavrusa test: RLS bochur B saw % days, expected 2 (shared+B)', seen;
  end if;
  if exists (select 1 from public.planner_days where id = 'd2222222-c0a0-4111-8111-111111111111') then
    raise exception 'chavrusa test: RLS bochur B saw chavrusa A day';
  end if;
end;
$rls_b$;

select set_config('request.jwt.claim.sub', 'b3333333-c0a0-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"b3333333-c0a0-4111-8111-111111111111","role":"authenticated"}', true);
do $rls_u$
declare seen int;
begin
  select count(*) into seen from public.planner_days where date in ('2099-01-15', '2099-01-16');
  if seen <> 1 then
    raise exception 'chavrusa test: RLS unassigned saw % days, expected 1 shared', seen;
  end if;
end;
$rls_u$;

select set_config('request.jwt.claim.sub', 'a1111111-c0a0-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"a1111111-c0a0-4111-8111-111111111111","role":"authenticated"}', true);
do $rls_s$
declare seen int;
begin
  select count(*) into seen from public.planner_days where date in ('2099-01-15', '2099-01-16');
  if seen <> 4 then
    raise exception 'chavrusa test: RLS shliach saw % days, expected 4', seen;
  end if;
end;
$rls_s$;

reset role;

select * from cora_chavrusa_test_result;
