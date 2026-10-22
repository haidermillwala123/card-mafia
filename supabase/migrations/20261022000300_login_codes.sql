-- Six-character sign-in codes sent by our own backend through Resend.
-- Only a keyed hash of the code is stored. The table is reachable by the service role only.
create table if not exists login_codes (
  email          text primary key,
  code_hash      text        not null,
  expires_at     timestamptz not null,
  attempts       int         not null default 0,
  sent_at        timestamptz not null default now(),
  hour_start     timestamptz not null default now(),
  sends_in_hour  int         not null default 1
);

alter table login_codes enable row level security;
-- No policies on purpose: anon and authenticated users get no access; the service role bypasses RLS.
revoke all on login_codes from anon, authenticated;
