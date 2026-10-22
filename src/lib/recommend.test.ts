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

// ---- whole-person recommendations (synthetic cards again) ----
const mk = (id: string, base: number, acc: { cat: 'groceries' | 'utilities' | 'travel_portal'; per100: number }[] = []) => ({
  card_id: id, name: id, base_earn: { points_per_100_inr: base },
  accelerated: acc.map(a => ({ category: `${a.cat} row`, points_per_100_inr: a.per100, monthly_cap_points: null, cap_note: '', cat: [a.cat] })),
  exclusions: [],
});
const three = (r: number) => ({ krisflyer: { perPoint: r }, 'flying-blue': { perPoint: r }, 'emirates-skywards': { perPoint: r } });

test('same earning but a better transfer ratio wins, even with a higher fee inside the limit', () => {
  const cs = [mk('magnus', 5), mk('burgundy', 5)];
  const m = { krisflyer: { magnus: { perPoint: 0.4 }, burgundy: { perPoint: 0.8 } }, 'flying-blue': { magnus: { perPoint: 0.4 }, burgundy: { perPoint: 0.8 } }, 'emirates-skywards': { magnus: { perPoint: 0.4 }, burgundy: { perPoint: 0.8 } } };
  const r = recommend({ cards: cs, miles: m, spend: { general: 50000 }, targets: [], held: [], fees: { magnus: 12500, burgundy: 30000 }, feeCap: Infinity });
  assert.equal(r.picks[0].card.card_id, 'burgundy');
  assert.ok(r.picks[0].gain > r.picks[1].gain * 1.9);
});

test('a regional currency with a big multiple cannot beat real miles unless the person picks it', () => {
  const cs = [mk('lcc', 4), mk('longhaul', 3)];
  const m = { spiceclub: { lcc: { perPoint: 3 }, longhaul: null }, krisflyer: { lcc: null, longhaul: { perPoint: 1 } }, 'flying-blue': { lcc: null, longhaul: { perPoint: 1 } }, 'emirates-skywards': { lcc: null, longhaul: { perPoint: 1 } } };
  const base = { cards: cs, miles: m, spend: { general: 30000 }, held: [], fees: {}, feeCap: Infinity };
  assert.equal(recommend({ ...base, targets: [] }).picks[0].card.card_id, 'longhaul');
  assert.equal(recommend({ ...base, targets: ['spiceclub'] }).picks[0].card.card_id, 'lcc');
});

test('breadth counts: reaching many programmes beats one lucky programme', () => {
  const cs = [mk('narrow', 5), mk('broad', 5)];
  const m = { krisflyer: { narrow: { perPoint: 1 }, broad: { perPoint: 0.6 } }, 'flying-blue': { narrow: null, broad: { perPoint: 0.6 } }, 'emirates-skywards': { narrow: null, broad: { perPoint: 0.6 } } };
  const r = recommend({ cards: cs, miles: m, spend: { general: 50000 }, targets: [], held: [], fees: {}, feeCap: Infinity });
  assert.equal(r.picks[0].card.card_id, 'broad');
  assert.equal(r.picks[0].breadth, 3);
});

test('a second card is suggested for the categories the first is weak at', () => {
  const cs = [mk('allrounder', 6), mk('grocer', 2, [{ cat: 'groceries', per100: 12 }, { cat: 'utilities', per100: 12 }])];
  const m = { krisflyer: { allrounder: { perPoint: 1 }, grocer: { perPoint: 1 } }, 'flying-blue': { allrounder: { perPoint: 1 }, grocer: { perPoint: 1 } }, 'emirates-skywards': { allrounder: { perPoint: 1 }, grocer: { perPoint: 1 } } };
  const spend = { general: 20000, groceries: 30000, utilities: 20000 };
  const r = recommend({ cards: cs, miles: m, spend, targets: [], held: [], fees: {}, feeCap: Infinity });
  assert.ok(r.companion, 'a companion card is offered');
  assert.equal(r.companion!.card.card_id, r.picks[0].card.card_id === 'allrounder' ? 'grocer' : 'allrounder');
  assert.ok(r.companion!.wins.some(w => w.cat === 'groceries' || w.cat === 'utilities' || w.cat === 'general'));
});

test('a much better card hidden by the fee limit is flagged as a stretch', () => {
  const cs = [mk('cheap', 2), mk('pricey', 8)];
  const m = { krisflyer: { cheap: { perPoint: 1 }, pricey: { perPoint: 1 } }, 'flying-blue': { cheap: { perPoint: 1 }, pricey: { perPoint: 1 } }, 'emirates-skywards': { cheap: { perPoint: 1 }, pricey: { perPoint: 1 } } };
  const r = recommend({ cards: cs, miles: m, spend: { general: 40000 }, targets: [], held: [], fees: { cheap: 1000, pricey: 30000 }, feeCap: 5000 });
  assert.equal(r.picks[0].card.card_id, 'cheap');
  assert.equal(r.stretch?.card.card_id, 'pricey');
});

test('cost per 1,000 miles is the annual fee over the extra miles in a year', () => {
  const r = recommend({ cards: [mk('a', 5)], miles: { krisflyer: { a: { perPoint: 1 } } }, spend: { general: 20000 }, targets: [], held: [], fees: { a: 12000 }, feeCap: Infinity });
  const p = r.picks[0];
  assert.ok(Math.abs(p.costPer1k! - 12000 / (p.annualMiles / 1000)) < 1e-6);
});

test('voucher and portal routes in the earn data are surfaced, not invented', () => {
  const c = { ...mk('v', 2), accelerated: [{ category: 'SmartBuy instant vouchers', points_per_100_inr: 10, monthly_cap_points: 10000, cap_note: '', cat: ['travel_portal' as const] }] };
  const r = recommend({ cards: [c], miles: { krisflyer: { v: { perPoint: 1 } } }, spend: { general: 10000 }, targets: [], held: [], fees: {}, feeCap: Infinity });
  assert.equal(r.picks[0].routes.length, 1);
  assert.equal(r.picks[0].routes[0].per100, 10);
});
