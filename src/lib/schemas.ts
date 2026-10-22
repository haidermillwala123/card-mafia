import { z } from 'zod';

// Ids are short slugs. Capping and shaping them means a request cannot carry a long or odd string into lookups, logs or prompts.
export const Slug = z.string().regex(/^[a-z0-9-]{1,64}$/);

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
