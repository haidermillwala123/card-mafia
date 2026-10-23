// Synthetic numbers shaped like the checkout screen (70,000 points needed, 4,000 short on a card); no real prices or accounts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type BuyInfo, buyCost, pointsShort } from './buy-points.ts';

const info = (over: Partial<BuyInfo> = {}): BuyInfo => ({
  programme: 'Test Club', url: 'https://example.com/buy', sells: true, pricePer1000: 30, currency: 'USD', inrPer1000: 2500, annualCap: 200000, note: null, source: null, sourceUrl: null, sourceDate: '2026-10-23', ...over,
});

test('the missing airline points follow the card shortfall and the ratio', () => {
  assert.equal(pointsShort({ need: 70000, held: null, cardShortBy: 4000, cardPointsPerPoint: 1 }), 4000);
  assert.equal(pointsShort({ need: 70000, held: null, cardShortBy: 4000, cardPointsPerPoint: 0.5 }), 8000); // two airline points per card point
  assert.equal(pointsShort({ need: 70000, held: null, cardShortBy: 4000, cardPointsPerPoint: 2 }), 2000);
  assert.equal(pointsShort({ need: 70000, held: 1500, cardShortBy: 4000, cardPointsPerPoint: 1 }), 2500); // points already in the programme come off
});

test('with no transfer path all the seat points are missing, never more, never negative', () => {
  assert.equal(pointsShort({ need: 70000, held: null, cardShortBy: null, cardPointsPerPoint: null }), 70000);
  assert.equal(pointsShort({ need: 70000, held: 20000, cardShortBy: null, cardPointsPerPoint: null }), 50000);
  assert.equal(pointsShort({ need: 70000, held: 90000, cardShortBy: null, cardPointsPerPoint: null }), 0);
  assert.equal(pointsShort({ need: 1000, held: null, cardShortBy: 99999, cardPointsPerPoint: 1 }), 1000); // a gap cannot exceed the seat
});

test('buying is priced in whole thousands, and no listed price means no figure', () => {
  assert.deepEqual(buyCost(info(), 4001), { native: 150, inr: 12500 }); // 5 blocks
  assert.deepEqual(buyCost(info(), 1000), { native: 30, inr: 2500 });
  assert.deepEqual(buyCost(info({ inrPer1000: null }), 2000), { native: 60, inr: null });
  assert.equal(buyCost(info({ pricePer1000: null }), 5000), null);
  assert.equal(buyCost(info(), 0), null);
});
