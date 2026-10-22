import { ONDEMAND_CAP } from '@/lib/seats/search';
import { DAILY_CAP, getStore } from '@/lib/seats/store';

export const dynamic = 'force-dynamic';

// The daily seats.aero call counter, so the app can show how fresh its data is.
// Only what the screen needs is returned: store type and ingest history stay on the server.
export async function GET() {
  const used = await getStore().quotaToday();
  return Response.json({ used, cap: DAILY_CAP, paused: used >= ONDEMAND_CAP });
}
