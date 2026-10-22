import { buildPlans } from '@/lib/engine/engine';
import { explainFallback } from '@/lib/engine/explain';
import { getData } from '@/lib/engine/load';
import { readJson } from '@/lib/guard';
import { PlanBody } from '@/lib/schemas';

export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = PlanBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: 'Check your trip and balances, then try again.' }, { status: 400 });
  const { data, source } = await getData();
  const name = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
  const result = buildPlans(data, body.data.trip, body.data.holdings, new Date());
  return Response.json({
    ...result,
    explanations: result.plans.map(p => explainFallback(p, name)),
    names: Object.fromEntries(data.programmes.map(p => [p.id, p.name])),
    meta: { sampleSeats: data.seats.sample, seatsFetchedAt: data.seats.fetched_at, rulesCheckedOn: data.rulesCheckedOn, rulesSource: source },
  });
}
