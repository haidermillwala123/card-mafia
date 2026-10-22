import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { amountOf, parseTrip, reviewNotes } from './parse.ts';
import { numbersMatch } from './explain.ts';

const cards = JSON.parse(readFileSync(new URL('../../data/cards.json', import.meta.url), 'utf8')).cards;
const NOW = new Date('2026-10-21T13:00:00Z');

test('Indian amounts read as points', () => {
  assert.equal(amountOf('1.2', 'L'), 120000);
  assert.equal(amountOf('65', 'k'), 65000);
  assert.equal(amountOf('1,20,000'), 120000);
  assert.equal(amountOf('4.5', 'lakh'), 450000);
});

test('the demo sentence parses to Qsuite, the US and one card, and asks which Amex', () => {
  const text = 'I want to go to the US in October. Doha to the US must be Qsuite. India to Doha can be anything. I have HDFC Infinia and Amex.';
  const p = parseTrip(text, NOW, cards);
  assert.equal(p.month, '2027-10');
  assert.equal(p.mustProduct, 'Qsuite');
  assert.deepEqual(p.dests, ['JFK', 'ORD', 'LAX', 'MIA']);
  assert.deepEqual(p.cardIds, ['hdfc-infinia']); // a bare "Amex" is never guessed
  assert.equal(p.travellers, 1);
  assert.ok(p.notes.some(n => /balance/.test(n)), 'asks for the missing balances');
  assert.ok(reviewNotes(text, p, ['2027-10'], ['JFK', 'ORD', 'LAX', 'MIA']).some(n => /which card/.test(n)), 'asks which Amex');
});

test('review notes warn about empty months, conflicting party sizes and a balance with no card', () => {
  const trip = (t: string) => parseTrip(t, NOW, cards);
  const asks = (t: string) => reviewNotes(t, trip(t), ['2027-10'], ['JFK']);
  assert.ok(asks('New York in May, Infinia 1.2L').some(n => /October 2027/.test(n)), 'month with no seats');
  assert.equal(asks('New York in October 2027, Infinia 1.2L').length, 0, 'a covered trip gets no warning');
  assert.ok(asks('New York in October, Infinia 1.2L, 1 traveller, 3 people').some(n => /party sizes/.test(n)));
  assert.ok(asks('6k points, New York in October').some(n => /no card name/.test(n)));
});

test('balances sit on the card they were typed next to', () => {
  const p = parseTrip('1.2L Infinia and 65k on my Platinum Travel card, US in October, 2 people', NOW, cards);
  assert.deepEqual(p.balances, { 'hdfc-infinia': 120000, 'amex-plat-travel': 65000 });
  assert.equal(p.travellers, 2);
});

test('a month that already started rolls to next year; a later month stays', () => {
  assert.equal(parseTrip('US in november', NOW, cards).month, '2026-11');
  assert.equal(parseTrip('US in September', NOW, cards).month, '2027-09');
  assert.equal(parseTrip('US in October 2028', NOW, cards).month, '2028-10');
});

test('a party size is not read as a balance', () => {
  const p = parseTrip('Infinia 1.2L, Chicago, October, 2 of us', NOW, cards);
  assert.deepEqual(p.balances, { 'hdfc-infinia': 120000 });
  assert.deepEqual(p.dests, ['ORD']);
  assert.equal(p.travellers, 2);
});

test('"12L" asks which amount instead of guessing', () => {
  const p = parseTrip('Infinia 12L, US in October', NOW, cards);
  assert.deepEqual(p.balances, {});
  assert.deepEqual(p.ambiguous, [{ cardId: 'hdfc-infinia', raw: '12L', options: [120000, 1200000] }]);
  assert.deepEqual(parseTrip('Infinia 12 lakh, US in October', NOW, cards).balances, { 'hdfc-infinia': 1200000 });
});

test('an unreadable sentence asks instead of guessing', () => {
  const p = parseTrip('take me somewhere nice', NOW, cards);
  assert.deepEqual(p.dests, []);
  assert.equal(p.month, null);
  assert.ok(p.notes.length >= 3);
});

test('places and cards we do not cover get a note, never a silent swap', () => {
  const p = parseTrip('Seattle to Mumbai business, Chase Sapphire Reserve 90k and Amex Gold 60k, December', NOW, cards);
  assert.deepEqual(p.cardIds, []);
  assert.ok(p.notes.some(n => /cannot plan Seattle/.test(n)));
  assert.ok(p.notes.some(n => /do not cover/.test(n)));
  assert.ok(!p.notes.some(n => /Tell us a US city/.test(n)), 'one place note, not two');
});

test('a month that has already started is flagged, and partners count as two travellers', () => {
  const p = parseTrip('Infinia 1.2L, US in Oct 2026 with my husband', NOW, cards);
  assert.ok(p.notes.some(n => /already started/.test(n)));
  assert.equal(p.travellers, 2);
  assert.equal(parseTrip('family of 4 to the US in March', NOW, cards).travellers, 4);
});

test('AI sentences may only use numbers that are in the facts', () => {
  const facts = { milesNeeded: 140000, transfers: [{ points: 120000, ratios: '1:1' }], date: '2027-10-03', valuePerPoint: 1.63 };
  assert.ok(numbersMatch('Move 1,20,000 points at 1:1 for the 1,40,000 miles on 3 Oct 2027, worth ₹1.63 a point.', facts));
  assert.ok(!numbersMatch('Move 1,20,000 points to cover 1,60,000 miles.', facts));
});
