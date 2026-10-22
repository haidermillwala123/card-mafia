-- Card Mafia: Supabase schema v1
-- Built from: MVP Scope (Revised) 21 Oct 2026, spec sheet v1.0, and the setup flow in card-mafia-flows/.
--
-- Conventions
--   * Reference data (banks, programmes, cards, rules, aircraft, seats) is read-only to clients. It changes through
--     migrations or the service role, matching the "versioned, human-reviewed rules" principle.
--   * Per-user data is owned by auth.uid() and protected by row level security.
--   * Money is stored in paise (bigint). Points are bigint. Dates and timestamps are ISO / timestamptz (UTC).
--   * Billing rows (subscriptions, payments) are written only by the server (service role, payment webhook).
--   * Never store card numbers, CVV or full UPI IDs. payments.instrument_hint holds a masked hint only.
--   * Out of scope for the MVP and therefore absent: Gmail / account linking, executing transfers or bookings.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.cabin_class as enum ('economy', 'premium_economy', 'business', 'first');
create type public.programme_kind as enum ('bank', 'airline', 'hotel');
create type public.rule_status as enum ('unverified', 'verified', 'stale', 'retired');
create type public.plan_tier as enum ('free', 'day', 'pro');
create type public.billing_period as enum ('monthly', 'yearly');
create type public.subscription_status as enum ('active', 'canceled', 'expired');
create type public.payment_method as enum ('upi', 'card');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.plan_kind as enum ('best_path', 'direct', 'get_card');
create type public.trip_status as enum ('draft', 'planned', 'archived');
create type public.alert_kind as enum ('seat', 'deadline', 'devaluation');
create type public.alert_channel as enum ('email', 'whatsapp');
create type public.correction_status as enum ('open', 'accepted', 'rejected');
create type public.balance_source as enum ('manual');

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reference data: banks, programmes, cards, airports, aircraft
-- ---------------------------------------------------------------------------
create table public.banks (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.programmes (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null unique,
  kind        public.programme_kind not null,
  bank_id     text references public.banks (id) on delete set null,   -- set for bank reward programmes
  iata_code   text check (iata_code ~ '^[A-Z0-9]{2}$'),                -- airline programmes
  alliance    text check (alliance in ('star', 'oneworld', 'skyteam')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index programmes_bank_id_idx on public.programmes (bank_id);

create table public.cards (
  id              text primary key check (id ~ '^[a-z0-9-]+$'),
  bank_id         text not null references public.banks (id),
  name            text not null,
  programme_id    text not null references public.programmes (id),    -- the reward programme the card earns into
  annual_fee_inr  numeric(12, 2) check (annual_fee_inr >= 0),
  earn_rate_note  text,
  eligibility_note text,
  active          boolean not null default true,
  source_url      text,
  verified_at     timestamptz,                                        -- null = not yet checked against the bank
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (bank_id, name)
);
create index cards_bank_id_idx on public.cards (bank_id);
create index cards_programme_id_idx on public.cards (programme_id);

create table public.airports (
  iata          text primary key check (iata ~ '^[A-Z]{3}$'),
  name          text not null,
  city          text not null,
  country_code  text not null check (country_code ~ '^[A-Z]{2}$'),
  created_at    timestamptz not null default now()
);

-- Which aircraft carry a real premium product, e.g. Qatar Qsuite. Backs the "true product" filter.
create table public.aircraft_products (
  id               uuid primary key default gen_random_uuid(),
  airline_iata     text not null check (airline_iata ~ '^[A-Z0-9]{2}$'),
  aircraft_type    text not null,
  product_name     text not null,
  is_true_product  boolean not null default true,
  notes            text,
  source_url       text,
  verified_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (airline_iata, aircraft_type, product_name)
);

-- ---------------------------------------------------------------------------
-- 4. Transfer rules (the graph) and their history
-- ---------------------------------------------------------------------------
-- One edge per (from, to, card). Rules chain into multi-hop paths; the agent picks the cheapest path per programme.
create table public.transfer_rules (
  id                  uuid primary key default gen_random_uuid(),
  from_programme_id   text not null references public.programmes (id),
  to_programme_id     text not null references public.programmes (id),
  card_id             text references public.cards (id),               -- null = every card of the from programme
  ratio_in            numeric(10, 4) not null check (ratio_in > 0),
  ratio_out           numeric(10, 4) not null check (ratio_out > 0),
  monthly_cap_points  bigint check (monthly_cap_points > 0),
  annual_cap_points   bigint check (annual_cap_points > 0),
  min_multiple        integer check (min_multiple > 0),
  fee_inr             numeric(12, 2) not null default 0 check (fee_inr >= 0),
  transfer_time_hours integer check (transfer_time_hours >= 0),
  promo_bonus_pct     numeric(6, 2) not null default 0 check (promo_bonus_pct >= 0),
  promo_valid_until   date,
  status              public.rule_status not null default 'unverified',
  source_url          text,
  source_note         text,
  verified_at         timestamptz,
  verified_by         text,
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint transfer_rules_no_self check (from_programme_id <> to_programme_id),
  -- a rule only reads as verified if it carries its source link and verified date
  constraint transfer_rules_verified_has_proof check (status <> 'verified' or (verified_at is not null and source_url is not null))
);
comment on column public.transfer_rules.ratio_in is 'Points leaving the from programme per ratio_out units arriving. A 2:1 rule is ratio_in 2, ratio_out 1.';
create unique index transfer_rules_edge_uniq
  on public.transfer_rules (from_programme_id, to_programme_id, coalesce(card_id, ''))
  where status <> 'retired';
create index transfer_rules_from_idx on public.transfer_rules (from_programme_id);
create index transfer_rules_to_idx on public.transfer_rules (to_programme_id);
create index transfer_rules_card_idx on public.transfer_rules (card_id);

-- Every insert or change keeps a snapshot, so a rule's past values stay auditable.
create table public.transfer_rule_history (
  id          bigint generated always as identity primary key,
  rule_id     uuid not null,                                           -- no FK on purpose: history outlives the rule
  version     integer not null,
  snapshot    jsonb not null,
  change_note text,
  pr_url      text,                                                    -- the reviewed pull request, when there is one
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index transfer_rule_history_rule_idx on public.transfer_rule_history (rule_id, version desc);

create function public.transfer_rules_bump() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new is distinct from old then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create function public.transfer_rules_log() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;                                    -- nothing changed, nothing to log
  end if;
  insert into public.transfer_rule_history (rule_id, version, snapshot, changed_by)
  values (new.id, new.version, to_jsonb(new), auth.uid());
  return new;
end;
$$;

create trigger transfer_rules_bump before update on public.transfer_rules
  for each row execute function public.transfer_rules_bump();
create trigger transfer_rules_log after insert or update on public.transfer_rules
  for each row execute function public.transfer_rules_log();

-- ---------------------------------------------------------------------------
-- 5. Cached seat availability (seats.aero). Data age = now() - fetched_at, shown on every result.
-- ---------------------------------------------------------------------------
create table public.seat_snapshots (
  id               uuid primary key default gen_random_uuid(),
  source           text not null default 'seats.aero',
  programme_id     text not null references public.programmes (id),   -- the programme selling the seat
  origin_iata      text not null check (origin_iata ~ '^[A-Z]{3}$'),
  dest_iata        text not null check (dest_iata ~ '^[A-Z]{3}$'),
  travel_date      date not null,
  cabin            public.cabin_class not null,
  miles            integer not null check (miles > 0),
  taxes_amount     numeric(12, 2) check (taxes_amount >= 0),
  taxes_currency   text not null default 'INR' check (taxes_currency ~ '^[A-Z]{3}$'),
  seats_available  smallint check (seats_available >= 0),
  airline_iata     text,
  aircraft_type    text,
  flight_numbers   text[] not null default '{}',
  is_direct        boolean,
  raw              jsonb,
  fetched_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (source, programme_id, origin_iata, dest_iata, travel_date, cabin, flight_numbers)
);
comment on table public.seat_snapshots is 'Cached third-party availability. MVP uses a non-commercial key; check the provider terms before any commercial use.';
create index seat_snapshots_lookup_idx on public.seat_snapshots (origin_iata, dest_iata, travel_date, cabin);
create index seat_snapshots_programme_idx on public.seat_snapshots (programme_id);
create index seat_snapshots_fetched_idx on public.seat_snapshots (fetched_at desc);

-- ---------------------------------------------------------------------------
-- 6. People: profile, banks, cards, balances, notification preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    extensions.citext,
  email_verified_at        timestamptz,                                -- mirrored from auth.users.email_confirmed_at
  first_name               text check (length(trim(first_name)) > 0),
  last_name                text check (length(trim(last_name)) > 0),
  date_of_birth            date check (date_of_birth >= date '1900-01-01'),
  home_airport             text check (home_airport ~ '^[A-Z]{3}$'),
  preferred_cabin          public.cabin_class not null default 'business',
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on column public.profiles.date_of_birth is 'Sensitive. Needed for award passenger details. Only the owner can read it; never log it.';
comment on column public.profiles.email is 'Mirror of auth.users.email for display. The sign-in identity lives in auth.users.';

-- "Bank relations": which banks the person banks with, and how.
create table public.user_banks (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  bank_id       text not null references public.banks (id),
  relationship  text not null default 'card' check (relationship in ('card', 'savings', 'salary', 'private', 'other')),
  created_at    timestamptz not null default now(),
  primary key (user_id, bank_id)
);
create index user_banks_bank_idx on public.user_banks (bank_id);

create table public.user_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  card_id     text not null references public.cards (id),
  nickname    text,
  created_at  timestamptz not null default now(),
  unique (user_id, card_id)
);
create index user_cards_card_idx on public.user_cards (card_id);

-- Balances are typed in. There is no account linking in the MVP.
create table public.point_balances (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  programme_id  text not null references public.programmes (id),
  balance       bigint not null check (balance >= 0),
  source        public.balance_source not null default 'manual',
  as_of         timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, programme_id)
);
create index point_balances_programme_idx on public.point_balances (programme_id);

create table public.notification_prefs (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  email_alerts     boolean not null default true,
  whatsapp_alerts  boolean not null default false,
  whatsapp_number  text check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint notification_prefs_whatsapp_needs_number check (not whatsapp_alerts or whatsapp_number is not null)
);

-- ---------------------------------------------------------------------------
-- 7. Billing (server-written). Free needs no row: no active subscription means Free.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  tier                 public.plan_tier not null check (tier <> 'free'),
  billing_period       public.billing_period,
  status               public.subscription_status not null default 'active',
  started_at           timestamptz not null default now(),
  current_period_end   timestamptz not null,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Pro bills monthly or yearly; the Day pass is one time
  constraint subscriptions_period_matches_tier check ((tier = 'pro') = (billing_period is not null))
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create unique index subscriptions_one_active_idx on public.subscriptions (user_id) where status = 'active';
create unique index subscriptions_one_day_pass_idx on public.subscriptions (user_id) where tier = 'day';  -- once per account

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles (id) on delete set null,   -- keep financial records if the account goes
  subscription_id      uuid references public.subscriptions (id) on delete set null,
  amount_paise         bigint not null check (amount_paise >= 0),                 -- before GST
  gst_paise            bigint not null check (gst_paise >= 0),
  total_paise          bigint generated always as (amount_paise + gst_paise) stored,
  currency             text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  method               public.payment_method not null,
  status               public.payment_status not null default 'pending',
  provider             text not null,
  provider_payment_id  text not null,
  instrument_hint      text,                                                      -- masked only, for example 'VISA ••4242'
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  unique (provider, provider_payment_id),
  constraint payments_paid_has_time check (status <> 'paid' or paid_at is not null)
);
create index payments_user_idx on public.payments (user_id);
create index payments_subscription_idx on public.payments (subscription_id);

-- ---------------------------------------------------------------------------
-- 8. Planning: trips, confirmed balances, top-3 plans, hops, safety checks
-- ---------------------------------------------------------------------------
create table public.trips (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  title                text,
  prompt_text          text,                                                      -- the sentence the person typed
  origin_iata          text check (origin_iata ~ '^[A-Z]{3}$'),
  destination          text,                                                      -- airport code or region, as parsed
  depart_from          date,
  depart_to            date,
  cabin                public.cabin_class not null default 'business',
  travellers           smallint not null default 1 check (travellers between 1 and 9),
  must_have_product    text,                                                      -- for example 'Qsuite'
  cash_fare_inr        numeric(12, 2) check (cash_fare_inr >= 0),                 -- typed by the person; feeds value per point
  parsed               jsonb,                                                     -- structured parse of prompt_text
  parsed_confirmed_at  timestamptz,                                               -- the person confirmed the parsed balances
  status               public.trip_status not null default 'draft',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint trips_dates_ordered check (depart_to is null or depart_from is null or depart_to >= depart_from),
  constraint trips_id_user_uniq unique (id, user_id)
);
create index trips_user_idx on public.trips (user_id, created_at desc);

-- Balances as confirmed for one trip, so a plan stays reproducible after balances change.
create table public.trip_balances (
  trip_id       uuid not null references public.trips (id) on delete cascade,
  programme_id  text not null references public.programmes (id),
  card_id       text references public.cards (id),
  balance       bigint not null check (balance >= 0),
  primary key (trip_id, programme_id)
);
create index trip_balances_programme_idx on public.trip_balances (programme_id);

create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  trip_id              uuid not null,
  user_id              uuid not null,
  rank                 smallint not null check (rank between 1 and 3),
  kind                 public.plan_kind not null,
  headline             text not null,
  target_programme_id  text references public.programmes (id),
  seat_snapshot_id     uuid references public.seat_snapshots (id) on delete set null,
  seat_fetched_at      timestamptz,                                               -- copied from the seat snapshot: data age at plan time
  travel_date          date,
  cabin                public.cabin_class,
  points_needed        bigint check (points_needed >= 0),
  taxes_inr            numeric(12, 2) check (taxes_inr >= 0),
  value_per_point      numeric(10, 2),
  from_card_id         text references public.cards (id),
  shortfall_points     bigint not null default 0 check (shortfall_points >= 0),
  recommended_card_id  text references public.cards (id),                         -- the card to get, for 'get_card' plans
  rules_verified_at    timestamptz,                                               -- oldest verified date across the hops
  risks                text[] not null default '{}',
  explanation          text,
  saved_at             timestamptz,                                               -- "Save for later"
  created_at           timestamptz not null default now(),
  unique (trip_id, rank),
  constraint plans_id_user_uniq unique (id, user_id),
  constraint plans_trip_owner_fk foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade,
  constraint plans_get_card_has_card check (kind <> 'get_card' or recommended_card_id is not null)
);
create index plans_user_idx on public.plans (user_id);
create index plans_snapshot_idx on public.plans (seat_snapshot_id);

-- A plan's path, one row per hop, with the ratios as they were when the plan was written.
create table public.plan_hops (
  plan_id            uuid not null references public.plans (id) on delete cascade,
  hop_order          smallint not null check (hop_order >= 1),
  rule_id            uuid references public.transfer_rules (id) on delete set null,
  from_programme_id  text not null references public.programmes (id),
  to_programme_id    text not null references public.programmes (id),
  ratio_in           numeric(10, 4) not null check (ratio_in > 0),
  ratio_out          numeric(10, 4) not null check (ratio_out > 0),
  points_in          bigint not null check (points_in >= 0),
  points_out         bigint not null check (points_out >= 0),
  primary key (plan_id, hop_order)
);
create index plan_hops_rule_idx on public.plan_hops (rule_id);

-- The pre-transfer safety check. The server fills the computed fields; the person confirms the rest.
create table public.safety_checks (
  id                            uuid primary key default gen_random_uuid(),
  plan_id                       uuid not null,
  user_id                       uuid not null,
  rules_verified                boolean not null,
  rules_verified_at             timestamptz,
  within_cap                    boolean not null,
  cap_used_points               bigint check (cap_used_points >= 0),
  cap_limit_points              bigint check (cap_limit_points >= 0),
  seat_age_minutes              integer check (seat_age_minutes >= 0),
  name_matches_confirmed_at     timestamptz,
  seat_confirmed_on_airline_at  timestamptz,
  acknowledged_irreversible_at  timestamptz,
  created_at                    timestamptz not null default now(),
  constraint safety_checks_plan_owner_fk foreign key (plan_id, user_id) references public.plans (id, user_id) on delete cascade
);
create index safety_checks_plan_idx on public.safety_checks (plan_id, created_at desc);
create index safety_checks_user_idx on public.safety_checks (user_id);

-- ---------------------------------------------------------------------------
-- 9. Later (v2): alerts and community rule corrections
-- ---------------------------------------------------------------------------
create table public.alerts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           public.alert_kind not null,
  channel        public.alert_channel not null,
  trip_id        uuid references public.trips (id) on delete set null,
  programme_id   text references public.programmes (id) on delete set null,
  rule_id        uuid references public.transfer_rules (id) on delete set null,
  payload        jsonb not null default '{}'::jsonb,
  scheduled_for  timestamptz not null,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index alerts_user_idx on public.alerts (user_id);
create index alerts_due_idx on public.alerts (scheduled_for) where sent_at is null;
create index alerts_trip_idx on public.alerts (trip_id);

create table public.rule_corrections (
  id            uuid primary key default gen_random_uuid(),
  submitted_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  rule_id       uuid references public.transfer_rules (id) on delete set null,
  proposed      jsonb not null,
  source_url    text not null,
  note          text,
  status        public.correction_status not null default 'open',
  review_note   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index rule_corrections_rule_idx on public.rule_corrections (rule_id);
create index rule_corrections_user_idx on public.rule_corrections (submitted_by);

-- ---------------------------------------------------------------------------
-- 10. updated_at triggers
-- ---------------------------------------------------------------------------
create trigger banks_updated before update on public.banks for each row execute function public.set_updated_at();
create trigger programmes_updated before update on public.programmes for each row execute function public.set_updated_at();
create trigger cards_updated before update on public.cards for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger point_balances_updated before update on public.point_balances for each row execute function public.set_updated_at();
create trigger notification_prefs_updated before update on public.notification_prefs for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger trips_updated before update on public.trips for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. Sign-up: create the profile, mirror verification, and read names passed as sign-in metadata
-- ---------------------------------------------------------------------------
create function public.sync_profile_from_auth() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, email_verified_at, first_name, last_name)
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        email_verified_at = excluded.email_verified_at;
  return new;
end;
$$;

create trigger on_auth_user_sync
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_profile_from_auth();

-- ---------------------------------------------------------------------------
-- 12. Functions and views
-- ---------------------------------------------------------------------------
-- Saves the whole setup flow in one transaction. Runs as the caller, so row level security applies.
-- p_balances is an object keyed by programme id, for example {"hdfc-reward-points": 120000}.
create function public.save_onboarding(
  p_first     text,
  p_last      text,
  p_dob       date,
  p_airport   text,
  p_cabin     public.cabin_class,
  p_bank_ids  text[] default '{}',
  p_card_ids  text[] default '{}',
  p_balances  jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  kv  record;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_dob is not null and p_dob > current_date then
    raise exception 'date of birth is in the future' using errcode = '22023';
  end if;
  if jsonb_typeof(p_balances) is distinct from 'object' then
    raise exception 'p_balances must be a JSON object' using errcode = '22023';
  end if;

  update public.profiles
     set first_name = nullif(trim(p_first), ''),
         last_name = nullif(trim(p_last), ''),
         date_of_birth = p_dob,
         home_airport = nullif(upper(trim(p_airport)), ''),
         preferred_cabin = coalesce(p_cabin, preferred_cabin),
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = uid;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  delete from public.user_banks where user_id = uid;
  insert into public.user_banks (user_id, bank_id)
    select uid, b from unnest(coalesce(p_bank_ids, '{}')) as b
    on conflict do nothing;

  delete from public.user_cards where user_id = uid;
  insert into public.user_cards (user_id, card_id)
    select uid, c from unnest(coalesce(p_card_ids, '{}')) as c
    on conflict do nothing;

  -- balances for programmes the person no longer lists are dropped, so a re-run sets the full state
  delete from public.point_balances
   where user_id = uid
     and programme_id not in (select jsonb_object_keys(p_balances));

  for kv in select key, value from jsonb_each_text(p_balances) loop
    insert into public.point_balances (user_id, programme_id, balance)
    values (uid, kv.key, kv.value::bigint)
    on conflict (user_id, programme_id) do update
      set balance = excluded.balance, as_of = now();
  end loop;
end;
$$;

-- True when the signed-in person has an active, unexpired Pro subscription or Day pass.
create function public.has_pro() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid() and s.status = 'active' and s.current_period_end > now()
  );
$$;

-- Plans with the age of their seat data, so every number can show "Seats 3 h old".
create view public.plan_summary with (security_invoker = true) as
  select p.*,
         case when p.seat_fetched_at is null then null
              else floor(extract(epoch from (now() - p.seat_fetched_at)) / 60)::integer end as seat_age_minutes
    from public.plans p;

-- ---------------------------------------------------------------------------
-- 13. Row level security and grants
-- ---------------------------------------------------------------------------
alter table public.banks enable row level security;
alter table public.programmes enable row level security;
alter table public.cards enable row level security;
alter table public.airports enable row level security;
alter table public.aircraft_products enable row level security;
alter table public.transfer_rules enable row level security;
alter table public.transfer_rule_history enable row level security;
alter table public.seat_snapshots enable row level security;
alter table public.profiles enable row level security;
alter table public.user_banks enable row level security;
alter table public.user_cards enable row level security;
alter table public.point_balances enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.trips enable row level security;
alter table public.trip_balances enable row level security;
alter table public.plans enable row level security;
alter table public.plan_hops enable row level security;
alter table public.safety_checks enable row level security;
alter table public.alerts enable row level security;
alter table public.rule_corrections enable row level security;

-- Start from nothing for client roles, then grant only what the product needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Public catalogue: readable before sign-in.
grant select on public.banks, public.programmes, public.cards, public.airports, public.aircraft_products to anon, authenticated;
create policy banks_read on public.banks for select to anon, authenticated using (true);
create policy programmes_read on public.programmes for select to anon, authenticated using (true);
create policy cards_read on public.cards for select to anon, authenticated using (true);
create policy airports_read on public.airports for select to anon, authenticated using (true);
create policy aircraft_products_read on public.aircraft_products for select to anon, authenticated using (true);

-- Rules and seats: signed-in people only. Retired rules stay hidden.
grant select on public.transfer_rules, public.transfer_rule_history, public.seat_snapshots to authenticated;
create policy transfer_rules_read on public.transfer_rules for select to authenticated using (status <> 'retired');
create policy transfer_rule_history_read on public.transfer_rule_history for select to authenticated using (true);
create policy seat_snapshots_read on public.seat_snapshots for select to authenticated using (true);

-- Profile: read own row; update only the fields the person owns (email and verification come from auth).
grant select on public.profiles to authenticated;
grant update (first_name, last_name, date_of_birth, home_airport, preferred_cabin, onboarding_completed_at) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Owned rows: full control by the owner.
grant select, insert, update, delete on public.user_banks, public.user_cards, public.point_balances, public.notification_prefs, public.trips to authenticated;
create policy user_banks_owner on public.user_banks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_cards_owner on public.user_cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy point_balances_owner on public.point_balances for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_prefs_owner on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy trips_owner on public.trips for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.trip_balances to authenticated;
create policy trip_balances_owner on public.trip_balances for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_balances.trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = trip_balances.trip_id and t.user_id = (select auth.uid())));

-- Plans, hops and safety checks are written by the server. The person reads them and can save a plan or confirm steps.
grant select on public.plans, public.plan_hops, public.safety_checks to authenticated;
grant update (saved_at) on public.plans to authenticated;
grant update (name_matches_confirmed_at, seat_confirmed_on_airline_at, acknowledged_irreversible_at) on public.safety_checks to authenticated;
grant select on public.plan_summary to authenticated;
create policy plans_select_own on public.plans for select to authenticated using (user_id = (select auth.uid()));
create policy plans_update_own on public.plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plan_hops_select_own on public.plan_hops for select to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_hops.plan_id and p.user_id = (select auth.uid())));
create policy safety_checks_select_own on public.safety_checks for select to authenticated using (user_id = (select auth.uid()));
create policy safety_checks_update_own on public.safety_checks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Billing: read only. Writes come from the payment webhook with the service role.
grant select on public.subscriptions, public.payments to authenticated;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy payments_select_own on public.payments for select to authenticated using (user_id = (select auth.uid()));

-- Alerts: the person reads and clears them. The server creates them.
grant select, delete on public.alerts to authenticated;
create policy alerts_select_own on public.alerts for select to authenticated using (user_id = (select auth.uid()));
create policy alerts_delete_own on public.alerts for delete to authenticated using (user_id = (select auth.uid()));

-- Community corrections: anyone signed in can propose; only they see their own. Review happens with the service role.
grant select on public.rule_corrections to authenticated;
grant insert (rule_id, proposed, source_url, note) on public.rule_corrections to authenticated;
create policy rule_corrections_select_own on public.rule_corrections for select to authenticated using (submitted_by = (select auth.uid()));
create policy rule_corrections_insert_own on public.rule_corrections for insert to authenticated
  with check (submitted_by = (select auth.uid()));

grant execute on function public.save_onboarding(text, text, date, text, public.cabin_class, text[], text[], jsonb) to authenticated;
grant execute on function public.has_pro() to authenticated;
