-- Card Mafia v2 booking hub: seat cache extras, ingest log, quota counter, route demand, alert watches, FX rates.
-- All new tables are locked down: only the service role touches them, except alert_watches (owner CRUD).

-- 1. seat_snapshots: fields needed to show a flight and to refresh it
alter table seat_snapshots
  add column if not exists availability_id text,
  add column if not exists stops smallint,
  add column if not exists departs_at timestamptz,
  add column if not exists arrives_at timestamptz,
  add column if not exists duration_minutes int,
  add column if not exists taxes_known boolean not null default true;
create index if not exists seat_snapshots_route_idx on seat_snapshots (origin_iata, dest_iata, travel_date, cabin);

-- 2. ingest log, so the UI can show data age and the daily quota counter
create table if not exists ingest_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  calls_used int not null default 0,
  rows_written int not null default 0,
  pairs jsonb,
  errors jsonb,
  quota_remaining int
);

create table if not exists quota_usage (
  day date primary key,
  calls int not null default 0,
  updated_at timestamptz not null default now()
);

-- 3. which origin/destination pairs people asked for; the daily cron refreshes these
create table if not exists route_requests (
  origin_iata text not null,
  dest_iata text not null,
  last_requested_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  request_count int not null default 1,
  primary key (origin_iata, dest_iata)
);

-- 4. exchange rates used to show taxes in rupees (each shown with its date)
create table if not exists fx_rates (
  currency text primary key,
  inr_per_unit numeric not null,
  as_of date not null,
  fetched_at timestamptz not null default now()
);

-- 5. a user's watched routes; the cron checks them and writes rows into alerts
create table if not exists alert_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_iata text not null check (origin_iata ~ '^[A-Z]{3}$'),
  dest_iata text not null check (dest_iata ~ '^[A-Z]{3}$'),
  depart_from date not null,
  depart_to date not null,
  cabin cabin_class not null default 'business',
  reachable_only boolean not null default true,
  email boolean not null default true,
  active boolean not null default true,
  last_match_count int not null default 0,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (depart_to >= depart_from)
);
create index if not exists alert_watches_user_idx on alert_watches (user_id);

-- 6. quota counter used by the ingest (service role only)
create or replace function bump_quota(n int) returns int
language plpgsql security definer set search_path = public as $$
declare total int;
begin
  insert into quota_usage(day, calls) values ((now() at time zone 'utc')::date, n)
  on conflict (day) do update set calls = quota_usage.calls + n, updated_at = now()
  returning calls into total;
  return total;
end $$;
revoke all on function bump_quota(int) from public, anon, authenticated;
grant execute on function bump_quota(int) to service_role;

-- 7. row level security
alter table ingest_runs enable row level security;
alter table quota_usage enable row level security;
alter table route_requests enable row level security;
alter table fx_rates enable row level security;
alter table alert_watches enable row level security;

revoke all on table ingest_runs, quota_usage, route_requests, fx_rates, alert_watches from anon, authenticated;
grant all on table ingest_runs, quota_usage, route_requests, fx_rates, alert_watches to service_role;

grant select, insert, update, delete on alert_watches to authenticated;
create policy alert_watches_owner on alert_watches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
