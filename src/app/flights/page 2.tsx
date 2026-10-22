import type { Metadata } from 'next';
import { addDaysIso, monthRange, todayIso } from '@/lib/app/format';
import FlightsClient, { type InitialParams } from './FlightsClient';

export const metadata: Metadata = {
  title: 'Search seats',
  description: 'Search award seats from India and see which of your cards can pay for each one, with the age of every result.',
  robots: { index: false },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Next 16: searchParams is a Promise.
export default async function FlightsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Default window is next calendar month. Computed here so server and browser agree.
  const next = addDaysIso(31 - Number(todayIso().slice(8, 10)) + 1).slice(0, 7);
  const def = monthRange(next);
  const initial: InitialParams = {
    o: one(sp.o) ?? null,
    d: one(sp.d) ?? null,
    from: one(sp.from) ?? def.from,
    to: one(sp.to) ?? def.to,
    cabin: one(sp.cabin) ?? 'business',
    n: one(sp.n) ?? '1',
    reach: one(sp.reach) ?? null,
    direct: one(sp.direct) === '1',
    p: one(sp.p) ?? '',
    max: one(sp.max) ?? '',
  };
  return <FlightsClient initial={initial} />;
}
