import { z } from 'zod';

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
    cardIds: z.array(z.string()).max(12),
    balances: z.record(z.string(), z.number().int().min(0).max(1000000000)),
  }),
});
