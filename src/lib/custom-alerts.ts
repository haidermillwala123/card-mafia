// What makes a custom alert fire. Pure functions: the daily job feeds them rows and today's date, and the Alerts page uses the same types.
// Four kinds: a dated reminder (points expiry, annual fee, anything), a seat under a price, a change in a card's transfer rules, a balance target.

export type CustomKind = 'reminder' | 'price' | 'rule' | 'balance';
export type Repeat = 'none' | 'monthly' | 'yearly';

export type CustomAlert = {
  id: string;
  user_id: string;
  kind: CustomKind;
  title: string;
  note: string | null;
  due_on: string | null; // YYYY-MM-DD
  remind_days_before: number;
  repeat: Repeat;
  params: Record<string, unknown>;
  email: boolean;
  active: boolean;
  state: Record<string, unknown>;
  last_fired_at: string | null;
  created_at: string;
};

// What the alerts table stores and the Alerts page shows for a custom alert.
export type CustomPayload = {
  custom: true;
  kind: CustomKind;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

export function addDays(s: string, n: number): string {
  return iso(new Date(parse(s).getTime() + n * DAY));
}

// Same day next month or year, clamped (31 Jan + 1 month = 28 or 29 Feb), so a repeat never skips a month.
export function addMonths(s: string, n: number): string {
  const d = parse(s);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return iso(t);
}

export const nextDue = (due: string, repeat: Repeat): string | null => (repeat === 'monthly' ? addMonths(due, 1) : repeat === 'yearly' ? addMonths(due, 12) : null);

// A reminder is due once today reaches (date minus lead days), and only once per date.
export function reminderDue(a: Pick<CustomAlert, 'due_on' | 'remind_days_before' | 'state'>, today: string): boolean {
  if (!a.due_on) return false;
  if (a.state.firedFor === a.due_on) return false;
  return today >= addDays(a.due_on, -a.remind_days_before);
}

// After a reminder fires: stop it, or roll it to the next date and clear the "already sent" mark.
export function afterReminder(a: Pick<CustomAlert, 'due_on' | 'repeat'>, today: string): { active: boolean; due_on: string | null; state: Record<string, unknown> } {
  if (!a.due_on) return { active: false, due_on: null, state: {} };
  let next = nextDue(a.due_on, a.repeat);
  // if the job missed a stretch, skip dates that are already behind us instead of firing a burst of old ones
  while (next && next < today) next = nextDue(next, a.repeat);
  return next ? { active: true, due_on: next, state: {} } : { active: false, due_on: a.due_on, state: { firedFor: a.due_on } };
}

export const priceMet = (cheapest: number | null, max: number) => cheapest !== null && Number.isFinite(max) && max > 0 && cheapest <= max;
export const balanceMet = (balance: number | null, atLeast: number) => balance !== null && Number.isFinite(atLeast) && atLeast > 0 && balance >= atLeast;

// ---- transfer rule changes ----
export type RuleLite = { to: string; ratio_in: number; ratio_out: number; monthly_cap: number | null; annual_cap: number | null };

// A stable text snapshot of every rule out of one points currency. Compared as text, so any change shows.
export function ruleDigest(rules: RuleLite[]): string {
  return [...rules]
    .sort((a, b) => a.to.localeCompare(b.to))
    .map(r => `${r.to}|${r.ratio_in}:${r.ratio_out}|${r.monthly_cap ?? ''}|${r.annual_cap ?? ''}`)
    .join('\n');
}

const parseDigest = (d: string) => new Map(d.split('\n').filter(Boolean).map(l => { const [to, ratio, m, y] = l.split('|'); return [to, { ratio, m, y }] as const; }));
const capText = (m: string, y: string) => (m ? `${Number(m).toLocaleString('en-IN')} a month` : y ? `${Number(y).toLocaleString('en-IN')} a year` : 'no cap found');

// Plain sentences describing what changed between two snapshots. Empty when nothing did.
export function ruleChanges(before: string, after: string, nameOf: (id: string) => string): string[] {
  const a = parseDigest(before), b = parseDigest(after);
  const out: string[] = [];
  for (const [to, now] of b) {
    const was = a.get(to);
    if (!was) { out.push(`${nameOf(to)} was added at ${now.ratio}.`); continue; }
    if (was.ratio !== now.ratio) out.push(`${nameOf(to)}: ratio changed from ${was.ratio} to ${now.ratio}.`);
    if (was.m !== now.m || was.y !== now.y) out.push(`${nameOf(to)}: limit changed from ${capText(was.m, was.y)} to ${capText(now.m, now.y)}.`);
  }
  for (const to of a.keys()) if (!b.has(to)) out.push(`${nameOf(to)} was removed.`);
  return out;
}
