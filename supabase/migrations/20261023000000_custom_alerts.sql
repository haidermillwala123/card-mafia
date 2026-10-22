-- Custom alerts: reminders (points expiry, annual fee, anything), a seat under a points price, a change in a card's transfer rules,
-- and a balance that reaches a target. The daily cron (api/cron) checks them and writes rows into alerts, then emails through Resend or Gmail.
-- Additive only: one new table, owner-only by row-level security. Nothing existing is touched.

create table if not exists custom_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'price', 'rule', 'balance')),
  title text not null check (char_length(title) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  due_on date,                                               -- reminders: the date the alert is about
  remind_days_before int not null default 0 check (remind_days_before between 0 and 365),
  repeat text not null default 'none' check (repeat in ('none', 'monthly', 'yearly')),
  params jsonb not null default '{}'::jsonb,                 -- price: origin, dest, from, to, cabin, max_points. rule: card_id. balance: card_id, at_least
  email boolean not null default true,
  active boolean not null default true,
  state jsonb not null default '{}'::jsonb,                  -- cron bookkeeping only: what it last saw, so it does not repeat itself
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'reminder' or due_on is not null)
);
create index if not exists custom_alerts_user_idx on custom_alerts (user_id);
create index if not exists custom_alerts_active_idx on custom_alerts (active) where active;

alter table custom_alerts enable row level security;
revoke all on table custom_alerts from anon, authenticated;
grant all on table custom_alerts to service_role;
grant select, insert, update, delete on custom_alerts to authenticated;
create policy custom_alerts_owner on custom_alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
