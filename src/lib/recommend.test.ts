// Synthetic cards and rates written for this test; none of these are real card terms.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommend } from './recommend.ts';

const card = (id: string, base: number, travel: number) => ({
  card_id: id, name: id, base_earn: { points_per_100_inr: base },
  accelerated: travel ? [{ category: 'Travel', points_per_100_inr: travel, monthly_cap_points: null, cap_note: '', cat: ['travel_portal' as const] }] : [],
  exclusions: [],
});
const cards = [card('everyday', 2, 0), card('traveller', 1, 10), card('premium', 4, 8)];
const miles = { 'indigo-bluchip': { everyday: { perPoint: 1 }, traveller: { perPoint: 0.5 }, premium: null }, krisflyer: { everyday: null, traveller: { perPoint: 0.4 }, premium: { perPoint: 1 } } };
const fees = { everyday: 0, traveller: 3000, premium: 20000 };
const spend = { general: 20000, travel_portal: 10000 };
const run = (p: Partial<Parameters<typeof recommend>[0]>) => recommend({ cards, miles, spend, targets: [], held: [], fees, feeCap: Infinity, ...p });

test('ranks by miles into the chosen airline, not by raw points', () => {
  const r = run({ targets: ['indigo-bluchip'] });
  // premium cannot reach IndiGo, so it cannot appear however many points it earns
  assert.deepEqual(r.picks.map(p => p.card.card_id).sort(), ['everyday', 'traveller']);
  assert.ok(r.picks.every(p => p.programme === 'indigo-bluchip'));
});

test('a card already held is never recommended and lowers what a new card adds', () => {
  const alone = run({ targets: ['krisflyer'] }).picks.find(p => p.card.card_id === 'traveller')!;
  const withPremium = run({ targets: ['krisflyer'], held: ['premium'] });
  assert.ok(!withPremium.picks.some(p => p.card.card_id === 'premium'));
  assert.ok(withPremium.baseline > 0);
  const after = withPremium.picks.find(p => p.card.card_id === 'traveller');
  assert.ok(!after || after.gain < alone.gain);
});

test('the fee limit removes expensive cards', () => {
  assert.ok(!run({ targets: ['krisflyer'], feeCap: 5000 }).picks.some(p => p.card.card_id === 'premium'));
});

test('with no spend nothing is recommended', () => {
  assert.equal(run({ spend: {} }).picks.length, 0);
});
