import type { Metadata } from 'next';
import PlanBoard from './PlanBoard';

export const metadata: Metadata = {
  title: 'Your plan',
  description: 'Up to three ways to pay for an award seat with your cards, built from cached seat data and checked transfer rules.',
  alternates: { canonical: '/plan' },
  robots: { index: false },
};

type Params = { o?: string; d?: string; from?: string; to?: string; cabin?: string; n?: string };

// Next 16: searchParams is a Promise. The board fills any missing value from the person's profile.
export default async function PlanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const one = (v: unknown) => (typeof v === 'string' ? v.slice(0, 40) : undefined);
  return <PlanBoard o={one(p.o)} d={one(p.d)} from={one(p.from)} to={one(p.to)} cabin={one(p.cabin)} n={one(p.n)} />;
}
