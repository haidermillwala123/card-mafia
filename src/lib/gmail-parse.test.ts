// Synthetic emails written for this test: no real customer data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractBalance, messageText, newestPerKey, parseEmail, senderOf } from './gmail-parse.ts';

const cards = [
  { id: 'hdfc-infinia', bank: 'hdfc', name: 'Infinia' },
  { id: 'hdfc-regalia', bank: 'hdfc', name: 'Regalia' },
  { id: 'axis-magnus', bank: 'axis', name: 'Magnus' },
  { id: 'axis-magnus-burgundy', bank: 'axis', name: 'Magnus Burgundy' },
];

test('reads a balance only when the sentence says balance', () => {
  assert.equal(extractBalance('Your closing balance of Reward Points: 1,24,500 as on 20 Oct'), 124500);
  assert.equal(extractBalance('Available balance: 45,000 points'), 45000);
  assert.equal(extractBalance('You currently have 67,250 Avios in your account'), 67250);
  assert.equal(extractBalance('You earned 250 points on this purchase'), null);
  assert.equal(extractBalance('Welcome to our new rewards programme'), null);
});

test('maps sender domains to a bank or a programme', () => {
  assert.deepEqual(senderOf('HDFC Bank <alerts@hdfcbank.net>'), { kind: 'bank', bank: 'hdfc' });
  assert.deepEqual(senderOf('Qatar <no-reply@mail.qatarairways.com>'), { kind: 'programme', programmeId: 'qatar-privilege-club' });
  assert.equal(senderOf('Someone <a@notabank.example>'), null);
  assert.equal(senderOf('x <a@evilhdfcbank.net>'), null);
});

test('names the card when the email does, and prefers the longer name', () => {
  const a = parseEmail({ from: 'a@hdfcbank.net', subject: 'Your Infinia statement', date: '2026-10-01', text: 'Reward points balance: 80,000' }, cards);
  assert.equal(a?.cardId, 'hdfc-infinia');
  assert.equal(a?.balance, 80000);
  const b = parseEmail({ from: 'a@axisbank.com', subject: 'Magnus Burgundy rewards', date: '2026-10-01', text: 'EDGE Reward Points balance: 12,345' }, cards);
  assert.equal(b?.cardId, 'axis-magnus-burgundy');
  const c = parseEmail({ from: 'a@hdfcbank.net', subject: 'Your statement', date: '2026-10-01', text: 'Reward points balance: 5,000' }, cards);
  assert.equal(c?.cardId, null);
});

test('reads GHA DISCOVERY dollars, including small amounts with cents', () => {
  assert.equal(extractBalance('Your DISCOVERY Dollars balance: D$ 45.50'), 45);
  assert.equal(extractBalance('D$ 1,250.00 available to spend'), 1250);
  assert.equal(extractBalance('You earned D$ 12.00 on your stay'), null);
  const f = parseEmail({ from: 'GHA DISCOVERY <hello@mail.ghadiscovery.com>', subject: 'Your D$ statement', date: '2026-10-01', text: 'Balance: D$ 80.25' }, cards);
  assert.equal(f?.programmeId, 'gha-discovery');
  assert.equal(f?.balance, 80);
});

test('keeps the newest email per source', () => {
  const mk = (date: string, balance: number) => ({ key: 'programme:krisflyer', kind: 'programme' as const, bank: null, programmeId: 'krisflyer', cardId: null, balance, date, subject: '', from: '' });
  assert.equal(newestPerKey([mk('2026-01-01', 10), mk('2026-09-01', 99), mk('2026-05-01', 50)])[0].balance, 99);
});

test('decodes Gmail message parts and strips html', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64url');
  const text = messageText({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b64('<p>Points <b>balance</b>: 9,000</p><style>p{}</style>') } }] });
  assert.equal(extractBalance(text), 9000);
});
