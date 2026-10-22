import { getData } from '@/lib/engine/load';
import { readJson } from '@/lib/guard';
import { firstIssue, RowsBody } from '@/lib/schemas';
import { decorate } from '@/lib/seats/reach';
import { withInr } from '@/lib/seats/search';
import { getStore } from '@/lib/seats/store';

// Full detail for the 1-3 seats being compared or checked out, with each of the person's cards priced against them.
export async function POST(req: Request) {
  const g = await readJson(req);
  if (!g.ok) return g.res;
  const body = RowsBody.safeParse(g.body);
  if (!body.success) return Response.json({ error: firstIssue(body.error, 'Pick up to three seats.') }, { status: 400 });
  const { ids, travellers, holdings } = body.data;
  try {
    const stored = await getStore().byIds(ids);
    const { rows, rates } = await withInr(stored);
    const { data } = await getData();
    const order = new Map(ids.map((id, i) => [id, i]));
    const views = decorate(rows, data, holdings, travellers).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return Response.json({
      rows: views,
      missing: ids.filter(id => !stored.some(r => r.id === id)),
      names: Object.fromEntries(data.programmes.map(p => [p.id, p.name])),
      rulesCheckedOn: data.rulesCheckedOn,
      fxAsOf: rates?.asOf ?? null,
    });
  } catch (e) {
    console.error('rows failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'We could not load those seats. Nothing was changed. Try again.' }, { status: 502 });
  }
}
