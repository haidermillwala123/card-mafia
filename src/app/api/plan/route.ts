import { data, programmeName } from '@/lib/engine/data';
import { buildPlans } from '@/lib/engine/engine';
import { explainFallback } from '@/lib/engine/explain';
import { PlanBody } from '@/lib/schemas';

export async function POST(req: Request) {
  const body = PlanBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Check your trip and balances, then try again.' }, { status: 400 });
  const result = buildPlans(data, body.data.trip, body.data.holdings, new Date());
  return Response.json({
    ...result,
    explanations: result.plans.map(p => explainFallback(p, programmeName)),
    names: Object.fromEntries(data.programmes.map(p => [p.id, p.name])),
    meta: { sampleSeats: data.seats.sample, seatsFetchedAt: data.seats.fetched_at, rulesCheckedOn: data.rulesCheckedOn },
  });
}
