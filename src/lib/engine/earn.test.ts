import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthlyPoints, rankCards, type AccRow, type EarnCard, type EarnFile } from '../earn.ts';

const row = (o: Partial<AccRow>): AccRow => ({ category: 'row', rate_text: '', points_per_100_inr: null, monthly_cap_points: null, cap_note: '', source_url: 'u', source_kind: 'official', cat: ['dining'], ...o });
const card = (id: string, base: number | null, accelerated: AccRow[] = [], exclusions: EarnCard['exclusions'] = []): EarnCard => ({
  card_id: id, name: id, reward_currency: 'pts', annual_fee_inr: null, joining_fee_inr: null,
  base_earn: { rate_text: '', points_per_100_inr: base, raw: base, source_url: 'u' },
  accelerated, exclusions, milestones: [], welcome_benefit: null, redemption_value: null, best_way_to_earn: '', terms_dated: null, sources: [], confidence: 'high', not_found: [], notes: '', source_quality: 'official', flags: [],
});

test('an uncapped accelerated row beats base and is flagged when its cap is not found', () => {
  const r = monthlyPoints(card('a', 2, [row({ points_per_100_inr: 10 })]), { dining: 10000 });
  assert.equal(r.points, 1000);
  assert.equal(r.byCategory[0].how, 'accelerated');
  assert.equal(r.byCategory[0].capUnknown, true);
  assert.ok(r.notes.some(n => /cap .* not found/.test(n)));
});

test('monthly cap limits accelerated points and the excess earns the base rate', () => {
  // Rs 20,000 at 10/100 would be 2,000; cap 500 covers Rs 5,000, the other Rs 15,000 earns 2/100 = 300
  const r = monthlyPoints(card('a', 2, [row({ points_per_100_inr: 10, monthly_cap_points: 500 })]), { dining: 20000 });
  assert.equal(r.points, 800);
  assert.equal(r.byCategory[0].capped, true);
});

test('spend under the cap is not capped', () => {
  const r = monthlyPoints(card('a', 2, [row({ points_per_100_inr: 10, monthly_cap_points: 500 })]), { dining: 4000 });
  assert.equal(r.points, 400);
  assert.equal(r.byCategory[0].capped, false);
});

test('an exclusion gives 0 for its category, but a soft (capped or reduced) one does not', () => {
  const hard = card('a', 1, [], [{ category: 'Fuel', note: 'No points', cat: ['fuel'], zero: true }]);
  assert.equal(monthlyPoints(hard, { fuel: 5000, dining: 1000 }).points, 10);
  assert.equal(monthlyPoints(hard, { fuel: 5000 }).byCategory[0].how, 'excluded');
  const soft = card('a', 1, [], [{ category: 'Fuel (capped)', note: 'capped', cat: ['fuel'], zero: false }]);
  assert.equal(monthlyPoints(soft, { fuel: 5000 }).points, 50);
});

test('an unknown rate skips the category and lists it in notes, never guessing base', () => {
  const c = card('a', 2, [row({ category: 'Dining partners', points_per_100_inr: null })]);
  const r = monthlyPoints(c, { dining: 10000, utilities: 1000 });
  assert.equal(r.points, 20); // only utilities at base
  assert.equal(r.skippedSpend, 10000);
  assert.equal(r.computedSpend, 1000);
  assert.ok(r.notes.some(n => /Dining partners/.test(n) && /not found/.test(n)));
  // missing base rate: category without any accelerated row is skipped too
  const nb = monthlyPoints(card('b', null), { groceries: 500 });
  assert.equal(nb.points, 0);
  assert.equal(nb.byCategory[0].how, 'skipped');
});

test('ranking orders by points, puts uncomputable cards last, and breaks ties by name', () => {
  const cards = [card('low', 1), card('none', null), card('high', 3), card('alsolow', 1)];
  const ranked = rankCards(cards, { online: 10000 });
  assert.deepEqual(ranked.map(x => x.card.card_id), ['high', 'alsolow', 'low', 'none']);
  assert.equal(ranked[0].points, 300);
});

test('the generated file covers all 58 cards and keeps the raw base value', () => {
  const f: EarnFile = JSON.parse(readFileSync(new URL('../../data/earn_rules.json', import.meta.url), 'utf8'));
  const cards = Object.values(f.cards);
  assert.equal(cards.length, 58);
  assert.ok(cards.every(c => 'raw' in c.base_earn && (c.base_earn.points_per_100_inr === null || typeof c.base_earn.points_per_100_inr === 'number')));
  const known = JSON.parse(readFileSync(new URL('../../data/cards.json', import.meta.url), 'utf8')).cards;
  assert.ok(known.every((k: { id: string }) => f.cards[k.id]));
  // rankings run over the real data without throwing
  assert.equal(rankCards(cards, { dining: 20000, fuel: 5000, travel_portal: 30000 }).length, 58);
});
