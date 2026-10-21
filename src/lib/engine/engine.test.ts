import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocate, bestPaths, buildPlans, combine, hopsFor, pointsFor, reachable, type Data, type Holdings, type Trip } from './engine.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
const seats = load('seats_cache');
const data: Data = {
  rules: load('transfer_rules').rules,
  rulesCheckedOn: '2026-10-21',
  cards: load('cards').cards,
  programmes: load('programmes').programmes,
  qsuite: load('qsuite_aircraft'),
  seats,
};
const NOW = new Date('2026-10-21T13:00:00Z');
const trip: Trip = { origin: 'DEL', dests: ['JFK', 'ORD', 'LAX', 'MIA'], month: '2027-10', travellers: 1, cabin: 'business', mustProduct: 'Qsuite', cashFareInr: null };
// the demo from the MVP scope: Infinia and Amex
const demo: Holdings = { cardIds: ['hdfc-infinia', 'amex-plat-travel'], balances: { 'hdfc-infinia': 120000, 'amex-plat-travel': 65000 } };

test('multi-hop path beats the direct 2:1 route to Qatar', () => {
  const multi = bestPaths(data, 'hdfc-infinia').get('qatar-privilege-club')!;
  assert.deepEqual(multi.map(r => r.id), ['hdfc-inf-finnair', 'finnair-ba', 'ba-qatar']);
  const direct = bestPaths(data, 'hdfc-infinia', true).get('qatar-privilege-club')!;
  assert.deepEqual(direct.map(r => r.id), ['hdfc-inf-qatar']);
  assert.equal(hopsFor(multi, 140000)[0].points_in, 140000);
  assert.equal(hopsFor(direct, 140000)[0].points_in, 280000);
});

test('a card only uses rules that name it', () => {
  assert.equal(bestPaths(data, 'hdfc-regalia').has('qatar-privilege-club'), false);
  assert.equal(bestPaths(data, 'hsbc-premier').get('qatar-privilege-club')!.length, 1);
});

test('hop rounding goes up, and the first hop honours its minimum multiple', () => {
  const [first] = hopsFor(bestPaths(data, 'hdfc-infinia').get('qatar-privilege-club')!, 140500);
  assert.equal(first.points_in, 141000);
});

test('allocation spends the cheapest chain first and reports the shortfall', () => {
  const sources = [
    { cardId: 'a', cardName: 'A', programme: 'p', rules: bestPaths(data, 'hdfc-infinia').get('qatar-privilege-club')!, balance: 100000 },
    { cardId: 'b', cardName: 'B', programme: 'q', rules: bestPaths(data, 'amex-plat-travel').get('qatar-privilege-club')!, balance: 20000 },
  ];
  const { transfers, shortfall } = allocate(sources, 120000);
  assert.deepEqual(transfers.map(t => [t.cardId, t.sourcePoints, t.targetMiles]), [['a', 100000, 100000], ['b', 20000, 10000]]);
  assert.equal(shortfall, 10000);
});

test('demo journey: Infinia plus Amex covers a Qsuite seat on the best path', () => {
  const res = buildPlans(data, trip, demo, NOW);
  const best = res.plans[0];
  assert.equal(best.kind, 'best_path');
  assert.equal(best.shortfallMiles, 0);
  assert.equal(best.milesNeeded, 140000);
  assert.deepEqual(best.transfers.map(t => [t.cardId, t.sourcePoints]), [['hdfc-infinia', 120000], ['amex-plat-travel', 40000]]);
});

test('the direct plan on the same seat is dearer and leaves a gap that names a card', () => {
  const res = buildPlans(data, trip, demo, NOW);
  const direct = res.plans.find(p => p.kind === 'direct')!;
  assert.equal(direct.seat, res.plans[0].seat);
  assert.equal(direct.shortfallMiles, 47500);
  const gap = buildPlans(data, trip, { cardIds: ['hdfc-infinia'], balances: { 'hdfc-infinia': 100000 } }, NOW).plans.find(p => p.kind === 'get_card')!;
  assert.ok(gap.newCard, 'a get_card plan names a card');
  assert.notEqual(gap.newCard!.cardId, 'hdfc-infinia');
});

test('non-Qsuite aircraft are dropped, never shown', () => {
  const res = buildPlans(data, trip, demo, NOW);
  assert.ok(res.considered.droppedNotQsuite > 0);
  for (const p of res.plans) assert.notEqual(p.seat.aircraft, '787-8');
  const open = buildPlans(data, { ...trip, mustProduct: null }, demo, NOW);
  assert.equal(open.considered.droppedNotQsuite, 0);
});

test('monthly caps flag extra months instead of hiding the plan', () => {
  const rich: Holdings = { cardIds: ['hdfc-diners'], balances: { 'hdfc-diners': 300000 } };
  const p = buildPlans(data, { ...trip, travellers: 2 }, rich, NOW).plans[0];
  assert.ok(p.safety.cap.monthsNeeded >= 2);
  assert.ok(p.risks.some(r => /a month/.test(r)));
});

test('every plan carries the data age and never promises a seat', () => {
  for (const p of buildPlans(data, trip, demo, NOW).plans) {
    assert.ok(p.safety.seatAgeMinutes > 0);
    assert.ok(!p.risks.join(' ').toLowerCase().includes('guaranteed') || /not guaranteed/.test(p.risks.join(' ')));
  }
});

test('value per point uses the typed fare minus taxes', () => {
  const p = buildPlans(data, { ...trip, cashFareInr: 600000 }, demo, NOW).plans[0];
  assert.equal(p.valuePerPoint, Math.round(((600000 - p.taxesInr) / p.sourcePointsTotal) * 100) / 100);
});

test('calculator: Infinia 1.2L reaches Qatar at 1:1 through the chain and BA at 2:1 directly', () => {
  const r = reachable(data, 'hdfc-infinia', 120000);
  const qatar = r.find(x => x.programme === 'qatar-privilege-club')!;
  assert.equal(qatar.miles, 120000);
  assert.equal(qatar.hops.length, 3);
  assert.equal(qatar.pointsPerMile, 1);
  assert.ok(r.every((x, i) => i === 0 || r[i - 1].miles >= x.miles), 'best first');
  assert.equal(r.find(x => x.programme === 'hdfc-reward-points'), undefined, 'banks are not targets');
});

test('calculator: direct-only shows the dearer 2:1 route', () => {
  const direct = reachable(data, 'hdfc-infinia', 120000, true).find(x => x.programme === 'qatar-privilege-club')!;
  assert.equal(direct.miles, 60000);
  assert.equal(direct.hops.length, 1);
});

test('calculator reverse: miles to points, with cap months', () => {
  const need = pointsFor(data, 'hdfc-infinia', 'qatar-privilege-club', 140000, true)!;
  assert.equal(need.pointsUsed, 280000);
  assert.equal(need.cap.monthsNeeded, 2);
  assert.equal(pointsFor(data, 'hdfc-regalia', 'qatar-privilege-club', 1000), null);
});

test('calculator combine: two cards cover 140k Avios, cheapest chain first', () => {
  const r = combine(data, demo, 'qatar-privilege-club', 140000);
  assert.equal(r.shortfall, 0);
  assert.deepEqual(r.transfers.map(t => [t.cardId, t.sourcePoints]), [['hdfc-infinia', 120000], ['amex-plat-travel', 40000]]);
});

test('an annual cap is a hard limit on the calculator', () => {
  const ba = reachable(data, 'axis-atlas', 500000).find(x => x.programme === 'ba-executive-club')!;
  assert.equal(ba.miles, 15000);
  assert.equal(ba.pointsUsed, 30000);
});

test('an unknown route says what is cached instead of failing', () => {
  const res = buildPlans(data, { ...trip, dests: ['BKK'] }, demo, NOW);
  assert.equal(res.plans.length, 0);
  assert.match(res.empty!, /Cached routes/);
});
