// Statement lines below are invented for the test: no real transactions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categorize, detectCard, monthlySpend, monthsCovered, parseStatementText } from './statement.ts';

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

test('reads PDF text where rows run together and columns follow the amount', () => {
  const flat = 'Statement Date: 20/10/2026 Total Dues 12,345.00 Domestic Transactions '
    + '12/10/2026| 14:32 SWIGGY BANGALORE + 12 C 1,245.00 l 14/10/2026| 21:15 AMAZON PAY INDIA MUMBAI + 23 C 2,300.50 l '
    + '15/10/2026| 09:05 INDIAN OIL FUEL STATION + 30 C 3,000.00 l 18/10/2026| 19:40 PAYMENT RECEIVED THANK YOU C 25,000.00 Cr '
    + '23/10/2026| 11:00 AIRBNB LONDON USD 120.00 C 9,980.00 l';
  const p = parseStatementText(flat);
  assert.equal(p.txns.length, 4);
  assert.equal(p.skipped, 1);
  assert.equal(p.txns[0].amount, 1245);
  assert.equal(p.txns[3].amount, 9980);
  assert.equal(p.txns[3].cat, 'international');
});

test('finds the card a statement belongs to, preferring the longer name', () => {
  const list = [
    { id: 'hdfc-regalia', bank: 'hdfc', name: 'Regalia' }, { id: 'hdfc-regalia-gold', bank: 'hdfc', name: 'Regalia Gold' },
    { id: 'hdfc-biz-black', bank: 'hdfc', name: 'Biz Black' }, { id: 'axis-magnus', bank: 'axis', name: 'Magnus' },
  ];
  assert.equal(detectCard('HDFC Bank BizBlack Credit Card Statement', list).cardId, 'hdfc-biz-black');
  assert.equal(detectCard('HDFC BANK Regalia Gold Credit Card', list).cardId, 'hdfc-regalia-gold');
  assert.equal(detectCard('Axis Bank Credit Card Statement', list).cardId, null);
  assert.equal(detectCard('Axis Bank Credit Card Statement', list).bank, 'axis');
});

test('drops credits and impossible dates, and does not stall on a huge line', () => {
  const p = parseStatementText('01/01/2026 FOO STORE -100.00 02/01/2026 BAR STORE -2,000.00 03/01/2026 BAZ STORE 5.00');
  assert.deepEqual(p.txns.map(t => t.amount), [5]);
  assert.equal(parseStatementText('31/02/2026 SOME SHOP 500.00').txns.length, 0);
  assert.equal(monthsCovered('bad', '2026-01-01'), 1);
  assert.equal(monthlySpend([{ date: '', desc: '', amount: 600, cat: 'dining', foreign: false }], 0).dining, 600);
  const t = Date.now();
  parseStatementText('01/01/2026 FOO ' + '1'.repeat(200000));
  assert.ok(Date.now() - t < 500);
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
