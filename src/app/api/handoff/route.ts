import { readJson } from '@/lib/guard';
import { firstIssue, IdBody } from '@/lib/schemas';
import { CABIN_LABEL, HANDOFF } from '@/lib/seats/sources';
import { withInr } from '@/lib/seats/search';
import { getStore } from '@/lib/seats/store';

// Where to book a seat and what to copy. We never book: this returns the programme's own site and a copy panel.
export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = IdBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Pick a seat first.') }, { status: 400 });
  const [row] = await getStore().byIds([body.data.id]);
  if (!row) return Response.json({ error: 'We no longer have that seat. Search again.' }, { status: 404 });
  const link = HANDOFF[row.source];
  const { rows } = await withInr([row]);
  const r = rows[0];
  return Response.json({
    programme: link?.name ?? row.programme_id,
    url: link?.url ?? null,
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
