import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { amountOf, parseTrip } from './parse.ts';

const cards = JSON.parse(readFileSync(new URL('../../data/cards.json', import.meta.url), 'utf8')).cards;
const NOW = new Date('2026-10-21T13:00:00Z');

test('Indian amounts read as points', () => {
  assert.equal(amountOf('1.2', 'L'), 120000);
  assert.equal(amountOf('65', 'k'), 65000);
  assert.equal(amountOf('1,20,000'), 120000);
  assert.equal(amountOf('4.5', 'lakh'), 450000);
});

test('the demo sentence parses to Qsuite, the US and two cards', () => {
  const p = parseTrip('I want to go to the US in October. Doha to the US must be Qsuite. India to Doha can be anything. I have HDFC Infinia and Amex.', NOW, cards);
  assert.equal(p.month, '2027-10');
  assert.equal(p.mustProduct, 'Qsuite');
  assert.deepEqual(p.dests, ['JFK', 'ORD', 'LAX', 'MIA']);
  assert.deepEqual(p.cardIds.sort(), ['amex-plat-travel', 'hdfc-infinia']);
  assert.equal(p.travellers, 1);
  assert.ok(p.notes.some(n => /balance/.test(n)), 'asks for the missing balances');
});

test('balances sit on the card they were typed next to', () => {
  const p = parseTrip('1.2L Infinia and 65k on my Amex card, US in October, 2 people', NOW, cards);
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

test('an unreadable sentence asks instead of guessing', () => {
  const p = parseTrip('take me somewhere nice', NOW, cards);
  assert.deepEqual(p.dests, []);
  assert.equal(p.month, null);
  assert.ok(p.notes.length >= 3);
});
