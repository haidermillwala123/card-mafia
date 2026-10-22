-- Card Mafia seed: SAMPLE reference data, safe to run more than once.
-- Nothing here is verified against a bank portal. Cards carry no fee or eligibility yet, and every rule below is
-- 'unverified'. Set status to 'verified' only together with source_url and verified_at (the table enforces this).
-- Not seeded on purpose: aircraft_products (which Qatar aircraft carry Qsuite is data Haider supplies and verifies).

insert into public.banks (id, name) values
  ('hdfc',  'HDFC Bank'),
  ('axis',  'Axis Bank'),
  ('amex',  'American Express'),
  ('sbi',   'SBI Card'),
  ('icici', 'ICICI Bank'),
  ('hsbc',  'HSBC'),
  ('kotak', 'Kotak'),
  ('idfc',  'IDFC FIRST'),
  ('sc',    'Standard Chartered')
on conflict (id) do nothing;

insert into public.programmes (id, name, kind, bank_id, iata_code, alliance) values
  ('hdfc-reward-points',               'HDFC Reward Points',               'bank', 'hdfc',  null, null),
  ('axis-edge-miles',                  'Axis EDGE Miles',                  'bank', 'axis',  null, null),
  ('axis-edge-rewards',                'Axis EDGE Rewards',                'bank', 'axis',  null, null),
  ('amex-membership-rewards',          'Amex Membership Rewards',          'bank', 'amex',  null, null),
  ('sbi-reward-points',                'SBI Reward Points',                'bank', 'sbi',   null, null),
  ('icici-reward-points',              'ICICI Reward Points',              'bank', 'icici', null, null),
  ('hsbc-reward-points',               'HSBC Reward Points',               'bank', 'hsbc',  null, null),
  ('kotak-reward-points',              'Kotak Reward Points',              'bank', 'kotak', null, null),
  ('idfc-first-reward-points',         'IDFC FIRST Reward Points',         'bank', 'idfc',  null, null),
  ('standard-chartered-reward-points', 'Standard Chartered Reward Points', 'bank', 'sc',    null, null),
  ('finnair-plus',                     'Finnair Plus',                     'airline', null, 'AY', 'oneworld'),
  ('ba-executive-club',                'British Airways Executive Club',   'airline', null, 'BA', 'oneworld'),
  ('qatar-privilege-club',             'Qatar Airways Privilege Club',     'airline', null, 'QR', 'oneworld')
on conflict (id) do nothing;

-- Card ids match the setup flow (card-mafia-flows/onboard.js).
insert into public.cards (id, bank_id, name, programme_id) values
  ('hdfc-infinia',       'hdfc',  'Infinia',                'hdfc-reward-points'),
  ('hdfc-diners',        'hdfc',  'Diners Club Black',      'hdfc-reward-points'),
  ('hdfc-regalia',       'hdfc',  'Regalia Gold',           'hdfc-reward-points'),
  ('axis-atlas',         'axis',  'Atlas',                  'axis-edge-miles'),
  ('axis-magnus',        'axis',  'Magnus',                 'axis-edge-rewards'),
  ('axis-reserve',       'axis',  'Reserve',                'axis-edge-rewards'),
  ('amex-plat-travel',   'amex',  'Platinum Travel',        'amex-membership-rewards'),
  ('amex-gold',          'amex',  'Gold Card',              'amex-membership-rewards'),
  ('amex-plat',          'amex',  'Platinum Card',          'amex-membership-rewards'),
  ('sbi-elite',          'sbi',   'Elite',                  'sbi-reward-points'),
  ('sbi-aurum',          'sbi',   'Aurum',                  'sbi-reward-points'),
  ('icici-emeralde',     'icici', 'Emeralde Private Metal', 'icici-reward-points'),
  ('icici-sapphiro',     'icici', 'Sapphiro',               'icici-reward-points'),
  ('hsbc-premier',       'hsbc',  'Premier',                'hsbc-reward-points'),
  ('hsbc-visa-infinite', 'hsbc',  'Visa Infinite',          'hsbc-reward-points'),
  ('kotak-white',        'kotak', 'White Reserve',          'kotak-reward-points'),
  ('idfc-wealth',        'idfc',  'Wealth',                 'idfc-first-reward-points'),
  ('sc-ultimate',        'sc',    'Ultimate',               'standard-chartered-reward-points')
on conflict (id) do nothing;

insert into public.airports (iata, name, city, country_code) values
  ('BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai',    'IN'),
  ('DEL', 'Indira Gandhi International Airport',               'Delhi',     'IN'),
  ('BLR', 'Kempegowda International Airport',                  'Bengaluru', 'IN'),
  ('HYD', 'Rajiv Gandhi International Airport',                'Hyderabad', 'IN'),
  ('MAA', 'Chennai International Airport',                     'Chennai',   'IN'),
  ('CCU', 'Netaji Subhas Chandra Bose International Airport',  'Kolkata',   'IN'),
  ('PNQ', 'Pune Airport',                                      'Pune',      'IN'),
  ('AMD', 'Sardar Vallabhbhai Patel International Airport',    'Ahmedabad', 'IN'),
  ('DOH', 'Hamad International Airport',                       'Doha',      'QA')
on conflict (iata) do nothing;

-- The demo route from the MVP scope: HDFC to Qatar directly at 2:1, or via Finnair and British Airways at 1:1 per hop.
-- Reported by cardholders on Reddit and not matched to the bank portal, so every rule stays 'unverified'.
insert into public.transfer_rules
  (from_programme_id, to_programme_id, ratio_in, ratio_out, status, source_note)
values
  ('hdfc-reward-points', 'qatar-privilege-club', 2, 1, 'unverified', 'SAMPLE. Direct route at 2:1. MVP Scope 21 Oct 2026; not matched to the bank portal.'),
  ('hdfc-reward-points', 'finnair-plus',         1, 1, 'unverified', 'SAMPLE. Hop 1 of the multi-hop route. Reported on Reddit; verify on the HDFC portal.'),
  ('finnair-plus',       'ba-executive-club',    1, 1, 'unverified', 'SAMPLE. Hop 2 of the multi-hop route. Reported on Reddit; verify before use.'),
  ('ba-executive-club',  'qatar-privilege-club', 1, 1, 'unverified', 'SAMPLE. Hop 3 of the multi-hop route. Reported on Reddit; BA can block Indian users at its ID check.')
on conflict (from_programme_id, to_programme_id, coalesce(card_id, '')) where status <> 'retired' do nothing;
