import { allow } from '@/lib/claude';
import { clientKey, readJson } from '@/lib/guard';
import { safeUrl } from '@/lib/safe-url';
import { firstIssue, IdBody } from '@/lib/schemas';
import { type BookingLink, pullTrips } from '@/lib/seats/client';
import { finalLink, sourceOf } from '@/lib/seats/deeplink';
import { CABIN_LABEL, HANDOFF } from '@/lib/seats/sources';
import { ONDEMAND_CAP, withInr } from '@/lib/seats/search';
import { getStore } from '@/lib/seats/store';
import { underDailyCap } from '@/lib/usage';

// The airline's own booking page with this seat's route, date and passengers already filled in, from the source's trip detail.
// One lookup per seat, remembered for half an hour on this server instance so opening the same seat twice costs nothing,
// and skipped when today's lookup budget is used up (the page then falls back to the programme's main page and says so).
const LINKS = new Map<string, { at: number; links: BookingLink[] }>();
async function prefilledLinks(availabilityId: string | null | undefined, store: ReturnType<typeof getStore>, who: string): Promise<BookingLink[]> {
  if (!availabilityId) return [];
  const hit = LINKS.get(availabilityId);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.links;
  if ((await store.quotaToday()) >= ONDEMAND_CAP || !(await underDailyCap('handoff', who, 80, 600))) return [];
  try {
    const { links } = await pullTrips(availabilityId);
    await store.bump(1);
    const clean = links.flatMap(l => { const url = safeUrl(l.url); return url ? [{ ...l, url }] : []; });
    if (LINKS.size > 500) LINKS.clear();
    LINKS.set(availabilityId, { at: Date.now(), links: clean });
    return clean;
  } catch {
    return [];
  }
}

// Where to book a seat and what to copy. We never book: this returns the programme's own site and a copy panel.
export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = IdBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Pick a seat first.') }, { status: 400 });
  if (!allow(clientKey(req), 20)) return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  const store = getStore();
  const [row] = await store.byIds([body.data.id]);
  if (!row) return Response.json({ error: 'We no longer have that seat. Search again.' }, { status: 404 });
  const link = HANDOFF[row.source];
  const links = await prefilledLinks(row.availability_id, store, clientKey(req));
  const main = links.find(l => l.primary) ?? null;
  const { rows } = await withInr([row]);
  const r = rows[0];
  // the supplied link, or the programme's main page, made to carry this seat's route, date, passengers and cabin
  const base = main?.url ?? link?.url ?? null;
  const n = body.data.n ?? 1;
  const fin = base ? finalLink({ source: row.source, url: base, origin: r.origin, dest: r.dest, date: r.date, cabin: r.cabin, n }) : null;
  // partner links get the same treatment, so "also bookable through" opens with your passengers and cabin too
  const partners = links.map(l => {
    const source = sourceOf(l.url);
    return source ? { ...l, url: finalLink({ source, url: l.url, origin: r.origin, dest: r.dest, date: r.date, cabin: r.cabin, n }).url } : l;
  });
  return Response.json({
    programme: link?.name ?? row.programme_id,
    url: fin?.url ?? null,
    prefilled: fin?.prefilled ?? false,
    links: partners,
    linkCheckedOn: link?.checkedOn ?? null, // null = not yet checked by hand; the page says so
    copy: {
      route: `${r.origin} → ${r.dest}`,
      date: r.date,
      cabin: CABIN_LABEL[r.cabin],
      flights: r.flights.join(', ') || null,
      points: r.miles,
      taxes: r.taxes_known && r.taxes_amount !== null ? { amount: r.taxes_amount, currency: r.taxes_currency, inr: r.taxes_inr } : null,
      seatSeenAt: r.updated_at,
    },
  });
}
