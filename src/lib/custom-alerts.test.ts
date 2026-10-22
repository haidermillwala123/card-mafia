// Synthetic dates and rules written for these tests; none of them are real card terms.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addMonths, afterReminder, balanceMet, priceMet, reminderDue, ruleChanges, ruleDigest } from './custom-alerts.ts';

test('a reminder is due from the lead day on, and only once per date', () => {
  const a = { due_on: '2026-12-10', remind_days_before: 7, state: {} };
  assert.equal(reminderDue(a, '2026-12-02'), false);
  assert.equal(reminderDue(a, '2026-12-03'), true);
  assert.equal(reminderDue(a, '2026-12-11'), true); // the job can run late and still catches it
  assert.equal(reminderDue({ ...a, state: { firedFor: '2026-12-10' } }, '2026-12-05'), false);
  assert.equal(reminderDue({ ...a, due_on: null }, '2026-12-05'), false);
});

test('months roll without skipping: 31 Jan plus a month is the end of February', () => {
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2026-03-15', 12), '2027-03-15');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('after a one-off reminder it stops; a repeating one moves to the next date', () => {
  assert.deepEqual(afterReminder({ due_on: '2026-12-10', repeat: 'none' }, '2026-12-03'), { active: false, due_on: '2026-12-10', state: { firedFor: '2026-12-10' } });
  assert.deepEqual(afterReminder({ due_on: '2026-12-10', repeat: 'yearly' }, '2026-12-03'), { active: true, due_on: '2027-12-10', state: { anchor: 10 } });
  assert.deepEqual(afterReminder({ due_on: '2026-12-10', repeat: 'monthly' }, '2026-12-03'), { active: true, due_on: '2027-01-10', state: { anchor: 10 } });
});

test('a repeat keeps its day of the month: 31st stays 31st, 29 Feb comes back', () => {
  let a = { due_on: '2027-01-31', repeat: 'monthly' as const, state: {} as Record<string, unknown> };
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) { const r = afterReminder(a, '2027-01-01'); seen.push(r.due_on!); a = { ...a, due_on: r.due_on!, state: r.state }; }
  assert.deepEqual(seen, ['2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  let y = { due_on: '2028-02-29', repeat: 'yearly' as const, state: {} as Record<string, unknown> };
  const years: string[] = [];
  for (let i = 0; i < 4; i++) { const r = afterReminder(y, '2028-01-01'); years.push(r.due_on!); y = { ...y, due_on: r.due_on!, state: r.state }; }
  assert.deepEqual(years, ['2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
});

test('a repeating reminder the job missed for months skips old dates instead of firing a burst', () => {
  const r = afterReminder({ due_on: '2026-01-10', repeat: 'monthly' }, '2026-06-20');
  assert.equal(r.due_on, '2026-07-10');
});

test('price and balance targets', () => {
  assert.equal(priceMet(60000, 60000), true);
  assert.equal(priceMet(60001, 60000), false);
  assert.equal(priceMet(null, 60000), false);
  assert.equal(priceMet(100, 0), false);
  assert.equal(balanceMet(100000, 100000), true);
  assert.equal(balanceMet(99999, 100000), false);
  assert.equal(balanceMet(null, 100000), false);
});

test('rule changes are described in plain words, and no change means no words', () => {
  const name = (id: string) => ({ krisflyer: 'KrisFlyer', flyingblue: 'Flying Blue', qatar: 'Qatar' } as Record<string, string>)[id] ?? id;
  const before = ruleDigest([
    { to: 'krisflyer', ratio_in: 5, ratio_out: 2, monthly_cap: null, annual_cap: 100000 },
    { to: 'flyingblue', ratio_in: 1, ratio_out: 1, monthly_cap: 150000, annual_cap: null },
  ]);
  assert.deepEqual(ruleChanges(before, before, name), []);
  const after = ruleDigest([
    { to: 'krisflyer', ratio_in: 3, ratio_out: 1, monthly_cap: null, annual_cap: 100000 },
    { to: 'flyingblue', ratio_in: 1, ratio_out: 1, monthly_cap: 100000, annual_cap: null },
    { to: 'qatar', ratio_in: 2, ratio_out: 1, monthly_cap: null, annual_cap: null },
  ]);
  const lines = ruleChanges(before, after, name);
  assert.ok(lines.some(l => /KrisFlyer: ratio changed from 5:2 to 3:1/.test(l)));
  assert.ok(lines.some(l => /Flying Blue: limit changed from 1,50,000 a month to 1,00,000 a month/.test(l)));
  assert.ok(lines.some(l => /Qatar was added at 2:1/.test(l)));
  assert.ok(ruleChanges(after, ruleDigest([]), name).every(l => /was removed/.test(l)));
});
