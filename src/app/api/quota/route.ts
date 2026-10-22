import { ONDEMAND_CAP } from '@/lib/seats/search';
import { DAILY_CAP, getStore } from '@/lib/seats/store';

export const dynamic = 'force-dynamic';

// The daily seats.aero call counter and the last ingest, so the app can show how fresh its data is.
export async function GET() {
  const store = getStore();
  const [used, last] = await Promise.all([store.quotaToday(), store.lastRun()]);
  return Response.json({ used, cap: DAILY_CAP, ondemandCap: ONDEMAND_CAP, paused: used >= ONDEMAND_CAP, store: store.kind, lastRun: last });
}
