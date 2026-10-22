-- GHA DISCOVERY as a hotel loyalty programme. point_balances.programme_id references programmes, so the row must exist before anyone can save a D$ balance.
-- Additive and safe to run twice.
insert into public.programmes (id, name, kind) values ('gha-discovery', 'GHA DISCOVERY', 'hotel')
on conflict (id) do nothing;
