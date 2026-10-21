import { allow, explainWithClaude } from '@/lib/claude';
import { data, programmeName } from '@/lib/engine/data';
import { buildPlans } from '@/lib/engine/engine';
import { explainFallback } from '@/lib/engine/explain';
import { PlanBody } from '@/lib/schemas';

// The plans are rebuilt here from the typed trip, so Claude only ever explains what the rules produced.
export async function POST(req: Request) {
  const body = PlanBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Check your trip and balances, then try again.' }, { status: 400 });
  const { plans } = buildPlans(data, body.data.trip, body.data.holdings, new Date());
  const fallback = plans.map(p => explainFallback(p, programmeName));
  if (!allow(req.headers.get('x-forwarded-for') ?? 'local')) return Response.json({ explanations: fallback, via: 'rules' });
  const fromClaude = plans.length ? await explainWithClaude(plans, programmeName) : null;
  return Response.json({ explanations: fromClaude ?? fallback, via: fromClaude ? 'claude' : 'rules' });
}
