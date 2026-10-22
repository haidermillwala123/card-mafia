// Daily job (Vercel Cron, Hobby plan = once a day): refresh the routes people searched or watch, then check every alert watch.
// Protected by CRON_SECRET: Vercel sends "Authorization: Bearer <CRON_SECRET>" itself when that env var exists.
import { timingSafeEqual } from 'node:crypto';
import { type CustomAlert } from '@/lib/custom-alerts';
import { runCustomAlerts } from '@/lib/custom-alerts-run';
import { emailConfigured, seatAlertEmail, sendEmail } from '@/lib/email';
import { getData } from '@/lib/engine/load';
import { sendOwnerDigest } from '@/lib/owner-digest';
import { pullRoutes, SeatsError } from '@/lib/seats/client';
import { decorate } from '@/lib/seats/reach';
import { windowFor, withInr } from '@/lib/seats/search';
import type { Cabin } from '@/lib/seats/sources';
import { DAILY_CAP, getStore, type Pair } from '@/lib/seats/store';
import { SITE_URL } from '@/lib/site';
import { admin, adminConfigured } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CALL_BUDGET = 300; // this run's share of the 1,000 daily calls; searches keep the rest
const TIME_BUDGET_MS = 30000; // refreshing seats; the alert checks after it get the rest of the 60 seconds
const DEADLINE_MS = 52000; // past this, stop starting new work so the run can close cleanly (finishRun) instead of being killed
const BATCH = 400; // rows per run, oldest-checked first, so a large backlog is worked through across days instead of timing out

type Watch = {
  id: string; user_id: string; origin_iata: string; dest_iata: string; depart_from: string; depart_to: string; cabin: Cabin;
  reachable_only: boolean; email: boolean; last_match_count: number;
};

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const sent = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || sent.length !== want.length || !timingSafeEqual(sent, want)) return Response.json({ error: 'Not allowed.' }, { status: 401 });
  if (!adminConfigured()) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 503 });

  const started = Date.now();
  const store = getStore();
  const runId = await store.startRun('cron');
  const errors: string[] = [];
  let calls = 0;
  let written = 0;
  const pulled: string[] = [];

  try {
    const sb = admin();
    const { data: watchRows } = await sb.from('alert_watches').select('*').eq('active', true).order('last_checked_at', { ascending: true, nullsFirst: true }).limit(BATCH);
    const watches = (watchRows ?? []) as Watch[];
    // Custom alerts live in their own table. If it is not there yet (migration not applied), carry on without them.
    const customRes = await sb.from('custom_alerts').select('*').eq('active', true).order('last_fired_at', { ascending: true, nullsFirst: true }).limit(BATCH);
    const customRows = (customRes.error ? [] : customRes.data ?? []) as CustomAlert[];
    const pricePairs = customRows.filter(c => c.kind === 'price').flatMap(c => {
      const p = c.params as Record<string, string>;
      return /^[A-Z]{3}$/.test(p.origin ?? '') && /^[A-Z]{3}$/.test(p.dest ?? '') ? [{ pair: [p.origin, p.dest] as Pair, cabin: (p.cabin ?? 'business') as Cabin }] : [];
    });
    const room = Math.max(0, Math.min(CALL_BUDGET, DAILY_CAP - 50 - (await store.quotaToday())));

    // 1. refresh: group wanted pairs by origin and cabin so each group is one request
    const wanted = [
      ...(await store.hotPairs(7, 80)),
      ...watches.map(w => ({ pair: [w.origin_iata, w.dest_iata] as Pair, cabin: w.cabin })),
      ...pricePairs,
    ];
    const groups = new Map<string, { origin: string; cabin: Cabin; dests: Set<string> }>();
    for (const { pair, cabin } of wanted) {
      const k = `${pair[0]}|${cabin}`;
      const g = groups.get(k) ?? { origin: pair[0], cabin, dests: new Set<string>() };
      g.dests.add(pair[1]);
      groups.set(k, g);
    }
    const win = windowFor(new Date().toISOString().slice(0, 10), '9999-12-31').full;
    for (const g of groups.values()) {
      if (calls + 3 > room || Date.now() - started > TIME_BUDGET_MS) break;
      const q = { origins: [g.origin], dests: [...g.dests], from: win.from, to: win.to, cabin: g.cabin };
      try {
        const at = new Date().toISOString();
        const r = await pullRoutes({ ...q, maxPages: 3 });
        calls += r.calls;
        await store.bump(r.calls);
        written += await store.upsert(r.rows, at);
        if (!r.truncated) await store.prune(q, at);
        await store.touch(q.dests.map(d => [g.origin, d] as Pair), g.cabin, true);
        pulled.push(`${g.origin}>${[...g.dests].join(',')} ${g.cabin}`);
      } catch (e) {
        errors.push(`${g.origin} ${g.cabin}: ${e instanceof Error ? e.message : 'failed'}`);
        if (e instanceof SeatsError && (e.quotaExhausted || e.status === 401 || e.status === 403)) break;
      }
    }

    // 2. alerts: compare what we hold now with what each watch last saw
    const { data } = await getData();
    const userIds = [...new Set(watches.map(w => w.user_id))];
    const [cardsRes, balRes, profRes, prefRes] = userIds.length
      ? await Promise.all([
          sb.from('user_cards').select('user_id,card_id').in('user_id', userIds),
          sb.from('point_balances').select('user_id,programme_id,balance').in('user_id', userIds),
          sb.from('profiles').select('id,email').in('id', userIds),
          sb.from('notification_prefs').select('user_id,email_alerts').in('user_id', userIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
    const holdingsOf = (uid: string) => {
      const cardIds = (cardsRes.data ?? []).filter(r => r.user_id === uid).map(r => r.card_id as string);
      const balances: Record<string, number> = {};
      for (const b of (balRes.data ?? []).filter(r => r.user_id === uid)) {
        const card = cardIds.find(id => data.cards.find(c => c.id === id)?.programme === b.programme_id);
        if (card) balances[card] = Number(b.balance);
      }
      return { cardIds, balances };
    };
    const names = new Map(data.programmes.map(p => [p.id, p.name]));
    let alerted = 0;
    let emailed = 0;
    for (const w of watches) {
      if (Date.now() - started > DEADLINE_MS - 6000) { errors.push('Time ran out: the rest of the watches wait for tomorrow.'); break; }
      const win2 = windowFor(w.depart_from, w.depart_to);
      const rows = await store.read({ origins: [w.origin_iata], dests: [w.dest_iata], from: win2.from, to: win2.to, cabin: w.cabin });
      const { rows: priced } = await withInr(rows);
      const hits = decorate(priced, data, w.reachable_only ? holdingsOf(w.user_id) : undefined, 1, { reachableOnly: w.reachable_only });
      const patch: Record<string, unknown> = { last_checked_at: new Date().toISOString(), last_match_count: hits.length };
      if (hits.length > w.last_match_count) {
        const best = hits[0];
        const { data: alert } = await sb.from('alerts').insert({
          user_id: w.user_id, kind: 'seat', channel: 'email', scheduled_for: new Date().toISOString(),
          payload: {
            watch_id: w.id, origin: w.origin_iata, dest: w.dest_iata, cabin: w.cabin, count: hits.length,
            best: { id: best.id, points: best.miles, date: best.date, programme: best.programme_id, programme_name: names.get(best.programme_id) ?? best.programme_id, taxes_inr: best.taxes_inr, seen_at: best.updated_at },
          },
        }).select('id').single();
        alerted += 1;
        patch.last_notified_at = new Date().toISOString();
        const to = profRes.data?.find(p => p.id === w.user_id)?.email as string | undefined;
        const pref = prefRes.data?.find(p => p.user_id === w.user_id);
        if (alert && w.email && to && pref?.email_alerts !== false && emailConfigured()) {
          const mail = seatAlertEmail({
            siteUrl: SITE_URL, origin: w.origin_iata, dest: w.dest_iata, count: hits.length, points: best.miles, date: best.date,
            programme: names.get(best.programme_id) ?? best.programme_id, seenHoursAgo: Math.max(0, Math.round((Date.now() - new Date(best.updated_at).getTime()) / 3600000)),
          });
          if ((await sendEmail(to, mail.subject, mail.html, mail.text)) === 'sent') {
            emailed += 1;
            await sb.from('alerts').update({ sent_at: new Date().toISOString() }).eq('id', alert.id);
          }
        }
      }
      await sb.from('alert_watches').update(patch).eq('id', w.id);
    }

    // 3. custom alerts: reminders, a seat under your price, changed transfer rules, balance targets. A failure here must not fail the run.
    let custom: { checked: number; fired: number; emailed: number; errors: string[] } = { checked: 0, fired: 0, emailed: 0, errors: [] };
    try {
      custom = await runCustomAlerts({ sb, store, data, rows: customRows, today: new Date().toISOString().slice(0, 10), siteUrl: SITE_URL, deadline: started + DEADLINE_MS });
    } catch (e) {
      custom.errors.push(e instanceof Error ? e.message : 'failed');
    }
    errors.push(...custom.errors);

    const quota = await store.quotaToday();
    await store.finishRun(runId, { calls_used: calls, rows_written: written, pairs: pulled, errors: errors.length ? errors : null, quota_remaining: DAILY_CAP - quota });
    // The owner's daily summary of new users and activity. A failure here must not fail the run.
    const digest = emailConfigured() ? await sendOwnerDigest().catch(() => 'failed' as const) : 'not-configured';
    return Response.json({ ok: true, calls, rowsWritten: written, groups: pulled.length, watches: watches.length, alerted, emailed, custom: { checked: custom.checked, fired: custom.fired, emailed: custom.emailed }, digest, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    await store.finishRun(runId, { calls_used: calls, rows_written: written, errors: [...errors, msg] });
    console.error('cron failed', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
