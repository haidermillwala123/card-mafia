// A synthetic seat shaped like the checkout screen: Infinia to Finnair Plus to Qatar, 65,000 points. No real account data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SeatView } from './api.ts';
import { stepsFor } from './steps.ts';

const names: Record<string, string> = { 'finnair-plus': 'Finnair Plus', 'qatar-privilege-club': 'Qatar Airways Privilege Club', 'ba-executive-club': 'British Airways Club' };
const seat = {
  miles: 65000, origin: 'MAA', dest: 'LHR', date: '2026-11-30', flights: ['QR529', 'QR15'],
  reach: {
    status: 'ok', pooled: null,
    best: {
      cardId: 'hdfc-infinia', cardName: 'Infinia', pointsUsed: 65000,
      hops: [
        { from: 'hdfc-infinia-pts', to: 'finnair-plus', ratio: '1:1', pointsIn: 65000, pointsOut: 65000, minMultiple: 1000, transferTime: '0 to 3 days' },
        { from: 'finnair-plus', to: 'qatar-privilege-club', ratio: '1:1', pointsIn: 65000, pointsOut: 65000, minMultiple: null, transferTime: 'Instant' },
      ],
    },
  },
} as unknown as SeatView;
const base = { r: seat, programme: 'Qatar Airways Privilege Club', n: 1, nameOf: (id: string) => names[id] ?? id, bankOf: (id: string) => (id === 'hdfc-infinia' ? 'hdfc' : undefined) };

test('a two-hop transfer lists every step in order and ends with the booking', () => {
  const p = stepsFor({ ...base, held: null });
  assert.equal(p.direct, false);
  assert.deepEqual(p.steps.map(s => s.title), [
    'Transfer 65,000 Infinia points to Finnair Plus',
    'Wait until the points show in Finnair Plus',
    'Move 65,000 Avios from Finnair Plus to British Airways Club',
    'Move 65,000 Avios from British Airways Club to Qatar Airways Privilege Club',
    'Wait until the points show in Qatar Airways Privilege Club',
    'Book on Qatar Airways Privilege Club',
  ]);
  assert.match(p.steps[0].note!, /blocks of 1,000/);
  assert.match(p.steps[0].note!, /Takes 0 to 3 days/);
  assert.equal(p.steps[0].link?.href, 'https://offers.smartbuy.hdfcbank.com/');
  // Avios do not go straight from Finnair Plus to Qatar: both legs use BA's Combine Avios page
  assert.match(p.steps[2].link!.href, /combine-avios/);
  assert.match(p.steps[2].note!, /pass through British Airways Club/);
  assert.match(p.steps[3].link!.href, /combine-avios/);
});

test('a bank with published steps gets them, an unknown bank gets plain wording and no link', () => {
  const icici = stepsFor({ ...base, held: null, bankOf: () => 'icici' }).steps[0];
  assert.match(icici.note!, /Redeem Now/);
  assert.equal(icici.link?.href, 'https://infinity.icicibank.com/');
  const other = stepsFor({ ...base, held: null, bankOf: () => 'kotak' }).steps[0];
  assert.match(other.note!, /net banking or card app/);
  assert.equal(other.link, undefined);
});

test('points already in the airline programme mean book directly, with no transfer steps', () => {
  const p = stepsFor({ ...base, held: 70000 });
  assert.equal(p.direct, true);
  assert.equal(p.steps.length, 2);
  assert.match(p.steps[0].title, /already have 70,000 points/);
  assert.equal(stepsFor({ ...base, held: 64999 }).direct, false); // one point short is not enough
});

test('travellers multiply the points needed', () => {
  assert.equal(stepsFor({ ...base, n: 2, held: 130000 }).direct, true);
  assert.equal(stepsFor({ ...base, n: 2, held: 100000 }).direct, false);
});
