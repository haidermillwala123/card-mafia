# Card Mafia: Supabase schema

Postgres schema, row level security and sample catalogue for Card Mafia. Built from the MVP Scope (21 Oct 2026), the spec sheet and the setup flow in `card-mafia-flows/`.

## Files

| File | What it is |
| --- | --- |
| `migrations/20261021000000_init.sql` | Tables, enums, triggers, RLS, grants, `save_onboarding()`, `has_pro()`, `plan_summary` view |
| `seed.sql` | Sample banks, programmes, cards, airports and the four demo transfer rules. Safe to run twice |
| `tests/run_local.sh` | Applies everything to a throwaway local Postgres and runs `tests/smoke.sql` (20 checks) |

## Apply it

Dashboard: open **SQL Editor**, paste `migrations/20261021000000_init.sql`, run, then paste `seed.sql` and run.

CLI, from the `AI Hackathon` folder:

```
supabase link --project-ref <your-project-ref>
supabase db push
psql "<connection string>" -f supabase/seed.sql
```

## Auth settings (Dashboard, Authentication)

- Email provider on. Email OTP length 6, matching the six-box code screen.
- In **Email Templates**, show the code with `{{ .Token }}` in both "Confirm sign up" (first sign-in) and "Magic Link" (returning). Without it people get a link, not a code.
- The built-in email sender is rate limited. Set up custom SMTP before real users.
- Pass the names at sign-in so the profile is filled the moment the code is verified:

```js
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true, data: { first_name, last_name } },
});
await supabase.auth.verifyOtp({ email, token, type: 'email' });
```

## Saving the setup flow

One call, one transaction. Ids are the slugs used in `onboard.js` and `seed.sql`.

```js
await supabase.rpc('save_onboarding', {
  p_first: 'Anaya', p_last: 'Kulkarni', p_dob: '1994-07-21', p_airport: 'BOM', p_cabin: 'business',
  p_bank_ids: ['hdfc', 'axis'],
  p_card_ids: ['hdfc-infinia', 'axis-atlas'],
  p_balances: { 'hdfc-reward-points': 120000, 'axis-edge-miles': 50000 },
});
```

Cabin values are `economy`, `premium_economy`, `business`, `first` (the flow shows "Premium economy"). Running it again replaces banks, cards and balances with what you send.

## Who writes what

| Data | Client (anon key + sign-in) | Server only (service role) |
| --- | --- | --- |
| banks, programmes, cards, airports, aircraft | read | write |
| transfer_rules, history, seat_snapshots | read, signed in only | write |
| profile | read, update own name, date of birth, airport, cabin | email, verification (mirrored from auth) |
| user_banks, user_cards, point_balances, trips, trip_balances, notification_prefs | full control of own rows | |
| plans, plan_hops, safety_checks | read own; save a plan; confirm safety steps | create, and all computed fields |
| subscriptions, payments | read own | write, from the payment webhook |
| alerts | read and delete own | create |
| rule_corrections | propose, read own | review |

The service role key stays on the server (Vercel API routes). Never put it in `config.js` or any browser file.

## Decisions baked in

- **Rules carry proof.** A rule can only be `verified` with a `source_url` and `verified_at`. Every change bumps `version` and writes a snapshot to `transfer_rule_history`.
- **Ratios.** `ratio_in : ratio_out`, so 2:1 is `2, 1`. Ratios differ by card inside one bank, so a rule can name a `card_id`.
- **Data age.** `seat_snapshots.fetched_at` is the source of truth; `plan_summary.seat_age_minutes` computes it.
- **Money.** Paise, with GST stored separately and `total_paise` computed. No card number, CVV or full UPI ID is ever stored; `instrument_hint` is a masked hint.
- **Free needs no row.** No active subscription means Free. The Day pass is once per account.
- **Deleting an account** removes personal data. Payment records stay, unlinked.

## What is not verified or not included

- The seed is sample data. Card fees and eligibility are empty, card-to-programme mappings come from the setup flow, and all four rules are `unverified` (sourced from Reddit reports in the MVP scope).
- `aircraft_products` is empty on purpose. Which Qatar aircraft carry Qsuite is data you supply.
- No Gmail or account-linking tables. The MVP scope says balances are typed in. The setup flow still has a "Read balances from Gmail" tile; that conflicts with the scope.
- Date of birth is sensitive. Decide retention, and keep it out of logs and analytics.
- seats.aero terms: the MVP key is non-commercial.
- Tested on local Postgres 16 with stand-ins for Supabase's `auth` schema, not on a live Supabase project.
