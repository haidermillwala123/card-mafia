import { z } from 'zod';

// Ids are short slugs. Capping and shaping them means a request cannot carry a long or odd string into lookups, logs or prompts.
export const Slug = z.string().regex(/^[a-z0-9-]{1,64}$/);

// Names the first field that failed, so a client sees what to fix instead of a generic message.
export function firstIssue(err: z.ZodError, lead: string): string {
  const i = err.issues[0];
  return i ? `${lead} Problem with ${i.path.join('.') || 'the request body'}: ${i.message}.` : lead;
}

const Iata = z.string().regex(/^[A-Z]{3}$/);
const IsoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
export const CabinEnum = z.enum(['economy', 'premium_economy', 'business', 'first']);
export const HoldingsBody = z.object({
  cardIds: z.array(Slug).max(12),
  balances: z.record(Slug, z.number().int().min(0).max(1000000000)),
});

// POST /api/search: cached seats for origins x destinations, joined to the cards a person holds.
export const SearchBody = z.object({
  origins: z.array(Iata).min(1).max(6),
  dests: z.array(Iata).min(1).max(40),
  from: IsoDate,
  to: IsoDate,
  cabin: CabinEnum.default('business'),
  travellers: z.number().int().min(1).max(9).default(1),
  holdings: HoldingsBody.optional(),
  filters: z
    .object({
      reachableOnly: z.boolean().optional(),
      directOnly: z.boolean().optional(),
      maxPoints: z.number().int().positive().max(10000000).optional(),
      programmes: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).max(60).optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

// POST /api/search/rows: full detail for the 1-3 rows being compared or checked out.
export const RowsBody = z.object({
  ids: z.array(z.string().regex(/^[A-Za-z0-9-]{8,40}$/)).min(1).max(3),
  travellers: z.number().int().min(1).max(9).default(1),
  holdings: HoldingsBody.optional(),
});

export const IdBody = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{8,40}$/) });

// Shared by /api/plan and /api/explain. Route files may only export HTTP handlers, so the schema lives here.
export const PlanBody = z.object({
  trip: z.object({
    origin: z.string().regex(/^[A-Z]{3}$/),
    dests: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(8),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    travellers: z.number().int().min(1).max(9),
    cabin: z.literal('business'),
    mustProduct: z.enum(['Qsuite']).nullable(),
    cashFareInr: z.number().min(0).max(100000000).nullable(),
  }),
  holdings: z.object({
    cardIds: z.array(Slug).max(12),
    balances: z.record(Slug, z.number().int().min(0).max(1000000000)),
  }),
});
