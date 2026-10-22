import { allow } from '@/lib/claude';
import { pullTrips, SeatsError } from '@/lib/seats/client';
import { clientKey, readJson } from '@/lib/guard';
import { firstIssue, IdBody } from '@/lib/schemas';
import { ONDEMAND_CAP, withInr } from '@/lib/seats/search';
import { getStore } from '@/lib/seats/store';

export const maxDuration = 30;

// Re-check one seat on seats.aero (Get Trips): fresh flight numbers, times, seats and taxes for a row someone is about to act on.
export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = IdBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Pick a seat to re-check.') }, { status: 400 });
  if (!allow(clientKey(req), 10)) return Response.json({ error: 'Too many re-checks. Wait a minute and try again.' }, { status: 429 });

  const store = getStore();
  const [row] = await store.byIds([body.data.id]);
  if (!row?.availability_id) return Response.json({ error: 'We no longer have that seat. Search again.' }, { status: 404 });
  if ((await store.quotaToday()) >= ONDEMAND_CAP) {
    const { rows } = await withInr([row]);
    return Response.json({ row: rows[0], refreshed: false, note: 'Live checks are paused today. Showing the saved seat.' });
  }
  try {
    const { trips } = await pullTrips(row.availability_id);
    await store.bump(1);
    const want = row.flights.join(', ');
    const trip = trips.find(t => t.Cabin === row.cabin && t.FlightNumbers === want) ?? null;
    if (!trip) return Response.json({ row: (await withInr([row])).rows[0], refreshed: false, gone: true, note: 'That flight is no longer listed. Do not transfer for it.' });
    const taxesKnown = row.taxes_known && Boolean(trip.TaxesCurrency);
    const next = {
      ...row,
      miles: Number(trip.MileageCost) || row.miles,
      seats: trip.RemainingSeats > 0 ? trip.RemainingSeats : null,
      stops: trip.Stops, direct: trip.Stops === 0,
      departs_at: trip.DepartsAt, arrives_at: trip.ArrivesAt, duration_minutes: trip.TotalDuration,
      taxes_amount: taxesKnown ? Math.round(Number(trip.TotalTaxes)) / 100 : row.taxes_amount,
      taxes_currency: taxesKnown ? trip.TaxesCurrency.toUpperCase() : row.taxes_currency,
      updated_at: trip.UpdatedAt, fetched_at: trip.UpdatedAt,
    };
    await store.upsert([next], new Date().toISOString());
    const { rows } = await withInr([next]);
    return Response.json({ row: rows[0], refreshed: true });
  } catch (e) {
    const quota = e instanceof SeatsError && e.quotaExhausted;
    return Response.json({ error: quota ? 'seats.aero live checks are used up for today.' : 'We could not re-check that seat. Nothing was changed.' }, { status: quota ? 429 : 502 });
  }
}
