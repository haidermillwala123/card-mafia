import { airport } from '@/lib/airports';
import { allow } from '@/lib/claude';
import { getData } from '@/lib/engine/load';
import { clientKey, readJson } from '@/lib/guard';
import { firstIssue, SearchBody } from '@/lib/schemas';
import { decorate } from '@/lib/seats/reach';
import { runSearch } from '@/lib/seats/search';

export const maxDuration = 60;

// Each visitor gets a limited number of live seats.aero pulls a day, so nobody can spend the shared 1,000-call quota alone.
// Cached results are never limited this way.
const PULLS_PER_DAY = 40;
const pulls = new Map<string, { day: string; n: number }>();
function takePull(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const cur = pulls.get(ip);
  const n = cur && cur.day === day ? cur.n : 0;
  if (n >= PULLS_PER_DAY) return false;
  if (pulls.size > 5000) pulls.clear();
  pulls.set(ip, { day, n: n + 1 });
  return true;
}

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = SearchBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Check the route, dates and cabin, then try again.') }, { status: 400 });
  if (!allow(clientKey(req), 20)) return Response.json({ error: 'Too many searches. Wait a minute and try again.' }, { status: 429 });
  const b = body.data;
  if (b.to < b.from) return Response.json({ error: 'The end date is before the start date.' }, { status: 400 });
  // checked before any live pull, so a typo or a made-up code never spends one of the day's seats.aero calls
  const unknown = [...b.origins, ...b.dests].find(code => !airport(code));
  if (unknown) return Response.json({ error: `We do not cover the airport ${unknown}. Pick one from the list.` }, { status: 400 });
  if (b.dests.every(d => b.origins.includes(d))) return Response.json({ error: 'Pick two different airports.' }, { status: 400 });

  try {
    const ip = clientKey(req);
    const { rows, meta } = await runSearch({ origins: b.origins, dests: b.dests, from: b.from, to: b.to, cabin: b.cabin, canPull: () => takePull(ip) });
    const { data } = await getData();
    const views = decorate(rows, data, b.holdings, b.travellers, b.filters);
    const names = Object.fromEntries(data.programmes.map(p => [p.id, p.name]));
    return Response.json({ rows: views.slice(0, b.limit), total: views.length, meta, names, rulesCheckedOn: data.rulesCheckedOn });
  } catch (e) {
    console.error('search failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'We could not load seats. Nothing was changed. Try again.' }, { status: 502 });
  }
}
