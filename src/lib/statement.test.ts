// Statement lines below are invented for the test: no real transactions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categorize, monthlySpend, monthsCovered, parseStatementText } from './statement.ts';

const text = `
HDFC BANK Credit Card Statement
12/10/2026 SWIGGY BANGALORE 1,245.00
14/10/2026 | 21:15 AMAZON PAY INDIA PRIVATE 2,300.50
15 Oct 2026 INDIAN OIL FUEL STATION 3,000.00
16-10-26 MAKEMYTRIP INDIA PVT LTD 18,450.00
18/10/2026 BIGBASKET 1,899.00
20/10/2026 PAYMENT RECEIVED THANK YOU 25,000.00 Cr
21/10/2026 FINANCE CHARGES 412.00
22/10/2026 ANNUAL FEE GST 1,800.00
23/10/2026 AIRBNB LONDON USD 120.00 9,980.00
24/10/2026 SOME LOCAL SHOP 540.00
Opening balance 5,000.00
`;

test('keeps spend lines and drops payments, fees and interest', () => {
  const p = parseStatementText(text);
  assert.equal(p.txns.length, 7);
  assert.equal(p.skipped, 3);
  assert.equal(p.from, '2026-10-12');
  assert.equal(p.to, '2026-10-24');
});

test('sorts merchants into spend categories', () => {
  const by = Object.fromEntries(parseStatementText(text).txns.map(t => [t.desc.split(' ')[0], t.cat]));
  assert.equal(by.SWIGGY, 'dining');
  assert.equal(by.AMAZON, 'online');
  assert.equal(by.INDIAN, 'fuel');
  assert.equal(by.MAKEMYTRIP, 'travel_portal');
  assert.equal(by.BIGBASKET, 'groceries');
  assert.equal(by.AIRBNB, 'international');
  assert.equal(by.SOME, 'general');
  assert.equal(categorize('INSTAMART BANGALORE').cat, 'groceries');
});

test('averages over the months the statement covers', () => {
  assert.equal(monthsCovered('2026-10-12', '2026-10-24'), 1);
  assert.equal(monthsCovered('2026-08-01', '2026-10-31'), 3);
  const m = monthlySpend([{ date: '', desc: '', amount: 6000, cat: 'dining', foreign: false }, { date: '', desc: '', amount: 3000, cat: 'dining', foreign: false }], 3);
  assert.equal(m.dining, 3000);
});
