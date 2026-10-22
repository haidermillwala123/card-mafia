// The daily check of everyone's custom alerts. Called from api/cron after the seat watches. Server only.
// Each alert is checked on its own, so one bad row can never stop the others. A fired alert becomes a row in `alerts` and, if the person
// wants it and email is set up (Resend or Gmail), an email.
import { type CustomAlert, type CustomKind, type CustomPayload, afterReminder, balanceMet, priceMet, reminderDue, type RuleLite, ruleChanges, ruleDigest } from '@/lib/custom-alerts';
import { customAlertEmail, emailConfigured, sendEmail } from '@/lib/email';
import type { Data } from '@/lib/engine/engine';
import { windowFor } from '@/lib/seats/search';
import type { Cabin } from '@/lib/seats/sources';
import type { getStore } from '@/lib/seats/store';
import type { admin } from '@/lib/supabase-admin';

// the alerts table has a fixed list of kinds; the custom payload says which custom kind it really is
const ENUM: Record<CustomKind, 'deadline' | 'devaluation' | 'seat'> = { reminder: 'deadline', rule: 'devaluation', price: 'seat', balance: 'deadline' };
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const fmt = (n: number) => n.toLocaleString('en-IN');
const longDate = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

type Fire = { body: string; cta?: { label: string; href: string } };
type Verdict = { fire?: Fire; patch?: { active?: boolean; due_on?: string | null; state?: Record<string, unknown> } };

export async function runCustomAlerts(o: {
  sb: ReturnType<typeof admin>; store: ReturnType<typeof getStore>; data: Data; rows: CustomAlert[]; today: string; siteUrl: string;
}): Promise<{ checked: number; fired: number; emailed: number; errors: string[] }> {
  const { sb, store, data, rows, today, siteUrl } = o;
  const res = { checked: rows.length, fired: 0, emailed: 0, errors: [] as string[] };
  if (!rows.length) return res;

  const uids = [...new Set(rows.map(r => r.user_id))];
  const [profs, prefs, bals] = await Promise.all([
    sb.from('profiles').select('id,email').in('id', uids),
    sb.from('notification_prefs').select('user_id,email_alerts').in('user_id', uids),
    sb.from('point_balances').select('user_id,programme_id,balance').in('user_id', uids),
  ]);
  const progName = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const cardOf = (id: unknown) => data.cards.find(c => c.id === id);

  async function check(a: CustomAlert): Promise<Verdict> {
    const p = a.params as Record<string, unknown>;

    if (a.kind === 'reminder') {
      if (!reminderDue(a, today) || !a.due_on) return {};
      const left = daysBetween(today, a.due_on);
      const when = left > 0 ? `Due on ${longDate(a.due_on)}, in ${left} ${left === 1 ? 'day' : 'days'}.` : left === 0 ? `Due today, ${longDate(a.due_on)}.` : `This was due on ${longDate(a.due_on)}.`;
      return { fire: { body: `${a.note ? `${a.note}\n\n` : ''}${when}` }, patch: afterReminder(a, today) };
    }

    if (a.kind === 'price') {
      const origin = String(p.origin ?? ''), dest = String(p.dest ?? ''), from = String(p.from ?? ''), to = String(p.to ?? ''), cabin = String(p.cabin ?? '');
      const max = Number(p.max_points);
      if (!IATA.test(origin) || !IATA.test(dest) || !DATE.test(from) || !DATE.test(to) || !CABINS.includes(cabin)) return {};
      const win = windowFor(from, to);
      const seats = await store.read({ origins: [origin], dests: [dest], from: win.from, to: win.to, cabin: cabin as Cabin });
      const best = seats.reduce<(typeof seats)[number] | null>((m, s) => (!m || s.miles < m.miles ? s : m), null);
      const met = priceMet(best?.miles ?? null, max);
      const was = a.state.hit === true;
      if (met && best && !was) {
        return {
          fire: {
            body: `${fmt(best.miles)} points on ${longDate(best.date)} with ${progName(best.programme_id)}, at or under your ${fmt(max)} points limit.\n\nSeats can disappear before you transfer, so check the seat and the transfer rules first.`,
            cta: { label: 'See the seats', href: `/flights?${new URLSearchParams({ o: origin, d: dest, from, to, cabin, n: '1' })}` },
          },
          patch: { state: { hit: true, last: best.miles } },
        };
      }
      if (!met && was) return { patch: { state: { hit: false } } };
      return {};
    }

    if (a.kind === 'rule') {
      const card = cardOf(p.card_id);
      if (!card) return {};
      const now = ruleDigest(data.rules.filter(r => r.from === card.programme).map<RuleLite>(r => ({ to: r.to, ratio_in: r.ratio_in, ratio_out: r.ratio_out, monthly_cap: r.monthly_cap ?? null, annual_cap: r.annual_cap ?? null })));
      const base = typeof a.state.baseline === 'string' ? a.state.baseline : null;
      if (base === null) return { patch: { state: { baseline: now } } }; // first look: remember today's rules, say nothing
      const lines = ruleChanges(base, now, progName);
      if (!lines.length) return {};
      return {
        fire: { body: `${lines.slice(0, 8).join('\n')}${lines.length > 8 ? `\n…and ${lines.length - 8} more.` : ''}\n\nCheck your bank portal before you move any points.`, cta: { label: 'See the rules', href: `/transfers/${card.id}` } },
        patch: { state: { baseline: now } },
      };
    }

    // balance
    const card = cardOf(p.card_id);
    const atLeast = Number(p.at_least);
    if (!card) return {};
    const row = (bals.data ?? []).find(b => b.user_id === a.user_id && b.programme_id === card.programme);
    const balance = row ? Number(row.balance) : null;
    const met = balanceMet(balance, atLeast);
    const was = a.state.hit === true;
    if (met && !was) return { fire: { body: `Your ${card.name} balance is ${fmt(balance as number)}, at or above your ${fmt(atLeast)} target.`, cta: { label: 'Find a seat to use them on', href: '/trips/ideas' } }, patch: { state: { hit: true } } };
    if (!met && was) return { patch: { state: { hit: false } } };
    return {};
  }

  for (const a of rows) {
    try {
      const v = await check(a);
      const patch: Record<string, unknown> = {};
      if (v.patch) {
        if (v.patch.state) patch.state = v.patch.state;
        if (v.patch.active !== undefined) patch.active = v.patch.active;
        if (v.patch.due_on !== undefined) patch.due_on = v.patch.due_on;
      }
      if (v.fire) {
        const payload: CustomPayload = { custom: true, kind: a.kind, title: a.title, body: v.fire.body, ...(v.fire.cta ? { cta: v.fire.cta } : {}) };
        const { data: row } = await sb.from('alerts').insert({ user_id: a.user_id, kind: ENUM[a.kind], channel: 'email', scheduled_for: new Date().toISOString(), payload }).select('id').single();
        patch.last_fired_at = new Date().toISOString();
        res.fired += 1;
        const to = profs.data?.find(x => x.id === a.user_id)?.email as string | undefined;
        const pref = prefs.data?.find(x => x.user_id === a.user_id);
        if (row && a.email && to && pref?.email_alerts !== false && emailConfigured()) {
          const mail = customAlertEmail({ siteUrl, kind: a.kind, title: a.title, body: v.fire.body, ctaLabel: v.fire.cta?.label, ctaHref: v.fire.cta?.href });
          if ((await sendEmail(to, mail.subject, mail.html, mail.text)) === 'sent') {
            res.emailed += 1;
            await sb.from('alerts').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
          }
        }
      }
      if (Object.keys(patch).length) await sb.from('custom_alerts').update(patch).eq('id', a.id);
    } catch (e) {
      res.errors.push(`${a.kind} ${a.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }
  return res;
}
