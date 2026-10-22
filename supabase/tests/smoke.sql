-- Smoke test for the Card Mafia schema: sign-up trigger, onboarding RPC, row level security, grants and constraints.
-- Run through tests/run_local.sh on a throwaway Postgres. Every check raises on failure, so a clean run means all passed.
\set ON_ERROR_STOP on
set client_min_messages = notice;

grant usage on schema extensions to anon, authenticated, service_role;

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'anaya@example.com', '{"first_name":"Anaya","last_name":"Kulkarni"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ravi@example.com', '{}');

-- 1. sign-up creates a profile, reads names from metadata, and mirrors email verification
do $$ begin
  assert (select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Anaya', 'names from sign-in metadata';
  assert (select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is null, 'no metadata means no name';
  assert (select email_verified_at from public.profiles where id = '00000000-0000-0000-0000-00000000000a') is null, 'not verified yet';
  update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000a';
  assert (select email_verified_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'verification mirrored';
  raise notice 'ok  sign-up creates profile and mirrors verification';
end $$;

-- 2. onboarding RPC saves everything, and a second run replaces instead of duplicating
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  perform public.save_onboarding('Anaya', 'Kulkarni', date '1994-07-21', 'bom', 'business',
    array['hdfc', 'axis'], array['hdfc-infinia', 'axis-atlas'],
    '{"hdfc-reward-points":120000,"axis-edge-miles":50000}'::jsonb);
  assert (select home_airport from public.profiles) = 'BOM', 'airport upper-cased';
  assert (select onboarding_completed_at is not null from public.profiles), 'onboarding stamped';
  assert (select count(*) from public.user_banks) = 2 and (select count(*) from public.user_cards) = 2, 'banks and cards saved';
  assert (select sum(balance) from public.point_balances) = 170000, 'balances saved';
  perform public.save_onboarding('Anaya', 'Kulkarni', date '1994-07-21', 'BOM', 'first',
    array['hdfc'], array['hdfc-infinia'], '{"hdfc-reward-points":90000}'::jsonb);
  assert (select count(*) from public.user_banks) = 1 and (select count(*) from public.user_cards) = 1, 'second run replaces';
  assert (select count(*) from public.point_balances) = 1 and (select balance from public.point_balances) = 90000, 'stale balances removed';
  assert (select preferred_cabin from public.profiles) = 'first', 'cabin updated';
  raise notice 'ok  save_onboarding saves and replaces';
end $$;

-- 3. onboarding RPC rejects bad input
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  begin
    perform public.save_onboarding('A', 'B', current_date + 1, 'BOM', 'business');
    raise exception 'expected future date of birth to be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_onboarding('A', 'B', null, 'BOM', 'business', '{}', '{}', '[1]'::jsonb);
    raise exception 'expected non-object balances to be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_onboarding('A', 'B', null, 'BOM', 'business', '{}', '{}', '{"hdfc-reward-points":-5}'::jsonb);
    raise exception 'expected negative balance to be rejected';
  exception when check_violation then null; end;
  raise notice 'ok  save_onboarding validates input';
end $$;

do $$ begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role authenticated';
  begin
    perform public.save_onboarding('A', 'B', null, 'BOM', 'business');
    raise exception 'expected signed-out call to fail';
  exception when invalid_authorization_specification then null; end;
  perform pg_temp.as_anon();
  begin
    perform public.save_onboarding('A', 'B', null, 'BOM', 'business');
    raise exception 'expected anon to lack execute';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  save_onboarding needs a signed-in user';
end $$;

-- 4. people cannot see each other's rows
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.point_balances) = 0, 'B sees no balances';
  assert (select count(*) from public.user_cards) = 0, 'B sees no cards';
  assert (select count(*) from public.profiles) = 1, 'B sees only own profile';
  assert (select id from public.profiles) = '00000000-0000-0000-0000-00000000000b', 'B profile is B';
  raise notice 'ok  rows are isolated per user';
end $$;

-- 5. grants: profile identity fields, billing and plans are not client-writable
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  begin
    update public.profiles set email = 'someone@else.example';
    raise exception 'expected email update to be denied';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set email_verified_at = now();
    raise exception 'expected verification update to be denied';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.payments (user_id, amount_paise, gst_paise, method, provider, provider_payment_id)
      values (auth.uid(), 1, 0, 'upi', 'x', 'y');
    raise exception 'expected payment insert to be denied';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.subscriptions (user_id, tier, billing_period, current_period_end)
      values (auth.uid(), 'pro', 'yearly', now() + interval '1 year');
    raise exception 'expected subscription insert to be denied';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  identity and billing are not client-writable';
end $$;

-- 6. catalogue is public, rules and seats need sign-in
do $$ begin
  perform pg_temp.as_anon();
  assert (select count(*) from public.banks) = 9, 'anon reads banks';
  assert (select count(*) from public.cards) = 18, 'anon reads cards';
  begin
    perform count(*) from public.transfer_rules;
    raise exception 'expected anon to be denied transfer_rules';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.profiles;
    raise exception 'expected anon to be denied profiles';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  catalogue public, rules private';
end $$;

do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.transfer_rules) = 4, 'signed-in reads rules';
  begin
    insert into public.banks (id, name) values ('evil', 'Evil Bank');
    raise exception 'expected catalogue write to be denied';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  signed-in reads rules, cannot write the catalogue';
end $$;

-- 7. rule constraints, history and versioning
do $$
declare rid uuid;
begin
  begin
    insert into public.transfer_rules (from_programme_id, to_programme_id, ratio_in, ratio_out, status)
      values ('kotak-reward-points', 'finnair-plus', 1, 1, 'verified');
    raise exception 'expected verified rule without proof to be rejected';
  exception when check_violation then null; end;
  begin
    insert into public.transfer_rules (from_programme_id, to_programme_id, ratio_in, ratio_out)
      values ('finnair-plus', 'finnair-plus', 1, 1);
    raise exception 'expected self transfer to be rejected';
  exception when check_violation then null; end;
  begin
    insert into public.transfer_rules (from_programme_id, to_programme_id, ratio_in, ratio_out)
      values ('hdfc-reward-points', 'qatar-privilege-club', 5, 2);
    raise exception 'expected duplicate edge to be rejected';
  exception when unique_violation then null; end;
  insert into public.transfer_rules (from_programme_id, to_programme_id, ratio_in, ratio_out, status, source_url, verified_at, verified_by)
    values ('kotak-reward-points', 'finnair-plus', 1, 1, 'verified', 'https://example.com/rule', now(), 'test');
  select id into rid from public.transfer_rules where from_programme_id = 'hdfc-reward-points' and to_programme_id = 'qatar-privilege-club';
  assert (select version from public.transfer_rules where id = rid) = 1, 'starts at version 1';
  update public.transfer_rules set ratio_in = 3 where id = rid;
  assert (select version from public.transfer_rules where id = rid) = 2, 'change bumps version';
  update public.transfer_rules set ratio_in = 3 where id = rid;
  assert (select version from public.transfer_rules where id = rid) = 2, 'no-op does not bump version';
  assert (select count(*) from public.transfer_rule_history where rule_id = rid) = 2, 'history keeps both versions';
  assert (select (snapshot ->> 'ratio_in')::numeric from public.transfer_rule_history where rule_id = rid and version = 1) = 2, 'history keeps old value';
  update public.transfer_rules set status = 'retired' where id = rid;
  insert into public.transfer_rules (from_programme_id, to_programme_id, ratio_in, ratio_out)
    values ('hdfc-reward-points', 'qatar-privilege-club', 2, 1);
  raise notice 'ok  rule constraints, versioning and history';
end $$;

do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.transfer_rules where status = 'retired') = 0, 'retired rules hidden';
  raise notice 'ok  retired rules are hidden from clients';
end $$;

-- 8. subscriptions and payments
do $$ begin
  insert into public.subscriptions (user_id, tier, billing_period, current_period_end)
    values ('00000000-0000-0000-0000-00000000000a', 'pro', 'yearly', now() + interval '1 year');
  begin
    insert into public.subscriptions (user_id, tier, billing_period, current_period_end)
      values ('00000000-0000-0000-0000-00000000000a', 'pro', 'monthly', now() + interval '1 month');
    raise exception 'expected second active subscription to be rejected';
  exception when unique_violation then null; end;
  begin
    insert into public.subscriptions (user_id, tier, current_period_end)
      values ('00000000-0000-0000-0000-00000000000b', 'pro', now() + interval '1 month');
    raise exception 'expected pro without a billing period to be rejected';
  exception when check_violation then null; end;
  begin
    insert into public.subscriptions (user_id, tier, billing_period, current_period_end)
      values ('00000000-0000-0000-0000-00000000000b', 'day', 'monthly', now() + interval '1 day');
    raise exception 'expected day pass with a billing period to be rejected';
  exception when check_violation then null; end;
  begin
    insert into public.subscriptions (user_id, tier, current_period_end)
      values ('00000000-0000-0000-0000-00000000000b', 'free', now() + interval '1 day');
    raise exception 'expected free tier row to be rejected';
  exception when check_violation then null; end;
  insert into public.subscriptions (user_id, tier, status, current_period_end)
    values ('00000000-0000-0000-0000-00000000000b', 'day', 'expired', now() - interval '1 day');
  begin
    insert into public.subscriptions (user_id, tier, current_period_end)
      values ('00000000-0000-0000-0000-00000000000b', 'day', now() + interval '1 day');
    raise exception 'expected second day pass to be rejected';
  exception when unique_violation then null; end;
  begin
    insert into public.payments (user_id, amount_paise, gst_paise, method, provider, provider_payment_id, status)
      values ('00000000-0000-0000-0000-00000000000a', 100, 18, 'upi', 'prov', 'p1', 'paid');
    raise exception 'expected paid payment without paid_at to be rejected';
  exception when check_violation then null; end;
  insert into public.payments (user_id, amount_paise, gst_paise, method, provider, provider_payment_id, status, paid_at, instrument_hint)
    values ('00000000-0000-0000-0000-00000000000a', 237203, 42697, 'card', 'prov', 'p2', 'paid', now(), 'VISA ••4242');
  assert (select total_paise from public.payments where provider_payment_id = 'p2') = 279900, 'total is amount plus GST';
  begin
    insert into public.payments (amount_paise, gst_paise, method, provider, provider_payment_id)
      values (1, 0, 'upi', 'prov', 'p2');
    raise exception 'expected duplicate provider payment id to be rejected';
  exception when unique_violation then null; end;
  raise notice 'ok  subscription and payment constraints';
end $$;

do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  assert public.has_pro(), 'A has Pro';
  assert (select count(*) from public.subscriptions) = 1 and (select count(*) from public.payments) = 1, 'A sees own billing';
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert not public.has_pro(), 'B expired day pass is not Pro';
  assert (select count(*) from public.payments) = 0, 'B sees no payments';
  raise notice 'ok  has_pro and billing visibility';
end $$;

-- 9. trips, plans, hops, safety checks
do $$
declare pid uuid;
begin
  insert into public.trips (id, user_id, prompt_text, origin_iata, cabin, travellers, must_have_product, cash_fare_inr)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a',
            'US in October, Qsuite from Doha. I hold Infinia and Amex.', 'DEL', 'business', 2, 'Qsuite', 87000);
  begin
    insert into public.plans (trip_id, user_id, rank, kind, headline)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 1, 'best_path', 'wrong owner');
    raise exception 'expected plan for another person''s trip to be rejected';
  exception when foreign_key_violation then null; end;
  insert into public.plans (trip_id, user_id, rank, kind, headline, points_needed, seat_fetched_at, rules_verified_at)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 1, 'best_path',
            'Doha to New York, Qsuite', 140000, now() - interval '3 hours', now() - interval '1 day')
    returning id into pid;
  begin
    insert into public.plans (trip_id, user_id, rank, kind, headline)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 1, 'direct', 'dup rank');
    raise exception 'expected duplicate rank to be rejected';
  exception when unique_violation then null; end;
  begin
    insert into public.plans (trip_id, user_id, rank, kind, headline)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 2, 'get_card', 'no card');
    raise exception 'expected get_card plan without a card to be rejected';
  exception when check_violation then null; end;
  begin
    insert into public.plans (trip_id, user_id, rank, kind, headline)
      values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 4, 'direct', 'rank 4');
    raise exception 'expected rank 4 to be rejected';
  exception when check_violation then null; end;
  insert into public.plan_hops (plan_id, hop_order, from_programme_id, to_programme_id, ratio_in, ratio_out, points_in, points_out) values
    (pid, 1, 'hdfc-reward-points', 'finnair-plus', 1, 1, 140000, 140000),
    (pid, 2, 'finnair-plus', 'ba-executive-club', 1, 1, 140000, 140000),
    (pid, 3, 'ba-executive-club', 'qatar-privilege-club', 1, 1, 140000, 140000);
  insert into public.safety_checks (plan_id, user_id, rules_verified, within_cap, cap_used_points, cap_limit_points, seat_age_minutes)
    values (pid, '00000000-0000-0000-0000-00000000000a', true, true, 62000, 100000, 180);
  begin
    insert into public.trips (user_id, depart_from, depart_to) values ('00000000-0000-0000-0000-00000000000a', date '2027-10-10', date '2027-10-01');
    raise exception 'expected reversed dates to be rejected';
  exception when check_violation then null; end;
  raise notice 'ok  plan constraints and ownership';
end $$;

do $$
declare n int;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  assert (select count(*) from public.plans) = 1, 'A sees own plan';
  assert (select count(*) from public.plan_hops) = 3, 'A sees own hops';
  assert (select count(*) from public.safety_checks) = 1, 'A sees own safety check';
  assert (select seat_age_minutes from public.plan_summary) between 179 and 181, 'plan_summary shows seat age';
  update public.plans set saved_at = now();
  get diagnostics n = row_count;
  assert n = 1, 'A can save own plan';
  update public.safety_checks set seat_confirmed_on_airline_at = now(), name_matches_confirmed_at = now();
  begin
    update public.plans set headline = 'edited';
    raise exception 'expected headline edit to be denied';
  exception when insufficient_privilege then null; end;
  begin
    update public.safety_checks set within_cap = false;
    raise exception 'expected computed safety field edit to be denied';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.plans (trip_id, user_id, rank, kind, headline)
      values ('00000000-0000-0000-0000-0000000000f1', auth.uid(), 3, 'direct', 'client written');
    raise exception 'expected client plan insert to be denied';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  owner reads plans and confirms steps; computed fields are server-only';
end $$;

do $$
declare n int;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.plans) = 0 and (select count(*) from public.plan_hops) = 0
     and (select count(*) from public.safety_checks) = 0 and (select count(*) from public.plan_summary) = 0, 'B sees nothing of A';
  update public.plans set saved_at = now();
  get diagnostics n = row_count;
  assert n = 0, 'B cannot touch A plan';
  raise notice 'ok  plans are private';
end $$;

-- 10. trip balances and corrections
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  insert into public.trip_balances (trip_id, programme_id, balance)
    values ('00000000-0000-0000-0000-0000000000f1', 'hdfc-reward-points', 120000);
  insert into public.rule_corrections (rule_id, proposed, source_url)
    values (null, '{"ratio_in": 1}'::jsonb, 'https://example.com/portal');
  assert (select submitted_by from public.rule_corrections) = auth.uid(), 'correction owner defaults to caller';
  begin
    insert into public.rule_corrections (proposed, source_url, status) values ('{}'::jsonb, 'https://example.com', 'accepted');
    raise exception 'expected status write to be denied';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  assert (select count(*) from public.rule_corrections) = 0 and (select count(*) from public.trip_balances) = 0, 'B sees neither';
  begin
    insert into public.trip_balances (trip_id, programme_id, balance)
      values ('00000000-0000-0000-0000-0000000000f1', 'axis-edge-miles', 1);
    raise exception 'expected write to another person''s trip to be denied';
  exception when insufficient_privilege then null; end;
  raise notice 'ok  trip balances and corrections are private';
end $$;

-- 11. deleting an account removes personal data but keeps financial records
do $$ begin
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
  assert (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'profile gone';
  assert (select count(*) from public.trips) = 0 and (select count(*) from public.point_balances) = 0, 'personal rows gone';
  assert (select count(*) from public.payments where provider_payment_id = 'p2' and user_id is null) = 1, 'payment kept, unlinked';
  raise notice 'ok  account deletion cascades, payments are kept';
end $$;

select 'smoke tests passed' as result;
