import buyJson from '@/data/buy_points.json';
import { allow } from '@/lib/claude';
import type { BuyEntry, BuyInfo } from '@/lib/buy-points';
import { clientKey, readJson } from '@/lib/guard';
import { firstIssue, IdBody } from '@/lib/schemas';
import { getRates, toInr } from '@/lib/seats/fx';
import { HANDOFF } from '@/lib/seats/sources';
import { getStore } from '@/lib/seats/store';

export const dynamic = 'force-dynamic';

const DATA = buyJson.programmes as Record<string, BuyEntry>;

// Where and roughly at what price a member can buy points in the seat's programme, so a short balance is a choice and not a dead end.
// Only programmes with a researched entry get a price; any other falls back to the programme's main page and no figure.
export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = IdBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Pick a seat first.') }, { status: 400 });
  if (!allow(clientKey(req), 30)) return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  const [row] = await getStore().byIds([body.data.id]);
  if (!row) return Response.json({ error: 'We no longer have that seat. Search again.' }, { status: 404 });

  const e = DATA[row.programme_id];
  const fallbackUrl = HANDOFF[row.source]?.url ?? null;
  if (!e) {
    const info: BuyInfo = {
      programme: HANDOFF[row.source]?.name ?? row.programme_id, url: fallbackUrl, sells: true, pricePer1000: null, currency: null, inrPer1000: null, annualCap: null,
      note: 'Most programmes sell points to signed-in members: look for Buy points in your account. We have no price for this one.', source: null, sourceUrl: null, sourceDate: null,
    };
    return Response.json(info);
  }
  const rates = e.price_per_1000 !== null && e.currency ? await getRates() : null;
  const inrPer1000 = e.price_per_1000 !== null && e.currency ? toInr(e.price_per_1000, e.currency, rates) : null;
  const info: BuyInfo = {
    programme: e.name, url: e.url, sells: e.url !== null, pricePer1000: e.price_per_1000, currency: e.currency,
    inrPer1000: inrPer1000 === null ? null : Math.round(inrPer1000), annualCap: e.annual_cap, note: e.note, source: e.source, sourceUrl: e.source_url, sourceDate: e.source_date,
  };
  return Response.json(info);
}
