// The AI (Gemini via OpenRouter; the file keeps its old name) does the language at both ends. It never does the maths: ratios, caps and seats come from the rules engine.
import { z } from 'zod';
import type { Card, Plan } from './engine/engine';
import type { ParsedTrip } from './engine/parse';
import { factsFor, numbersMatch } from './engine/explain';

// Google models only, served by Google's own infrastructure, reached through OpenRouter.
const MODEL = 'google/gemini-3.7-flash';

// Short timeouts keep the demo under 15 seconds: on a slow reply the rules text is used instead.
async function ask(system: string, user: string, maxTokens: number, timeoutMs: number): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        // this model always reasons first; minimal effort keeps it fast, and the extra room stops reasoning from eating the answer
        reasoning: { effort: 'minimal' },
        max_tokens: maxTokens + 1500,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        provider: { only: ['google-vertex', 'google-ai-studio'], allow_fallbacks: false },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}
const jsonIn = (s: string | null): unknown => {
  const m = s?.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  try {
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
};

const ParseOut = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  dests: z.array(z.enum(['JFK', 'ORD', 'LAX', 'MIA'])),
  origin: z.string().regex(/^[A-Z]{3}$/).nullable(),
  travellers: z.number().int().min(1).max(9),
  mustProduct: z.enum(['Qsuite']).nullable(),
  cards: z.array(z.object({ id: z.string(), balance: z.number().int().min(0).nullable() })),
  cashFareInr: z.number().min(0).nullable(),
});

export async function parseWithClaude(text: string, today: string, cards: Card[], homeAirport: string): Promise<ParsedTrip | null> {
  const system = `You turn one sentence about an award-flight trip from India into JSON. Return only the JSON object, no prose.
Keys: month ("YYYY-MM" or null), dests (array of JFK, ORD, LAX, MIA; "the US" means all four), origin (3-letter Indian airport or null), travellers (integer, default 1), mustProduct ("Qsuite" if the person requires Qsuite, else null), cards (array of {id, balance}), cashFareInr (number or null).
Rules: use null when the sentence does not say. Never guess a balance. "1.2L" or "1.2 lakh" is 120000, "65k" is 65000. A month that has already started this year means next year. Today is ${today}.
Card ids you may use: ${cards.map(c => `${c.id} (${c.name})`).join('; ')}. "Amex" alone means amex-plat-travel. Amex Gold, Green or Blue and cards from outside India (Chase, Citi, Capital One) are not in the list: leave them out. "husband", "wife" or "partner" means travellers 2; "family of N" means N.`;
  const out = ParseOut.safeParse(jsonIn(await ask(system, text.slice(0, 700), 500, 6000)));
  if (!out.success) return null;
  const known = new Set(cards.map(c => c.id));
  const held = out.data.cards.filter(c => known.has(c.id));
  const notes = held.filter(c => c.balance == null).map(c => `We could not read a balance for ${cards.find(x => x.id === c.id)!.name}. Add it below.`);
  if (!held.length) notes.push('We found no cards in that sentence. Pick your cards below.');
  if (!out.data.month) notes.push('We could not read a month. Pick one below.');
  if (!out.data.dests.length) notes.push('We can plan Doha to the US for now. Tell us a US city.');
  return {
    origin: out.data.origin ?? homeAirport, dests: out.data.dests, month: out.data.month, travellers: out.data.travellers, cabin: 'business',
    mustProduct: out.data.mustProduct, cardIds: held.map(c => c.id), ambiguous: [],
    balances: Object.fromEntries(held.filter(c => c.balance != null).map(c => [c.id, c.balance!])), cashFareInr: out.data.cashFareInr, notes,
  };
}

export async function explainWithClaude(plans: Plan[], name: (id: string) => string): Promise<string[] | null> {
  const system = `You write the plain-language explanation of award-flight plans for an Indian cardholder.
Use only the facts in the JSON. Do not add numbers, partners, dates or ratios that are not there. Never promise a seat, a price or a saving.
Two sentences at most and 55 words at most per plan. Write Indian digit grouping (1,40,000). Plain, exact, quietly confident. No exclamation marks.
Money is in rupees: write ₹ before valuePerPoint.
Return a JSON array of strings, one per plan, in the same order.`;
  const facts = plans.map(p => factsFor(p, name));
  const out = z.array(z.string().min(1).max(500)).safeParse(jsonIn(await ask(system, JSON.stringify(facts), 800, 6000)));
  // a sentence with a number the rules never produced is dropped for the whole set, so the screen shows the rules text instead
  return out.success && out.data.length === plans.length && out.data.every((t, i) => numbersMatch(t, facts[i])) ? out.data : null;
}

// Best-effort limiter for the two endpoints that spend Claude tokens. In-memory, so per server instance.
const hits = new Map<string, number[]>();
export function allow(ip: string, perMinute = 30): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - (v.at(-1) ?? 0) > 60000) hits.delete(k); // keep the map from growing without bound
  return recent.length <= perMinute;
}
