import type { Metadata } from 'next';
import HandoffClient from './HandoffClient';

export const metadata: Metadata = {
  title: 'Book on the airline site',
  description: 'The steps and a copy panel for booking one award seat on the airline programme site.',
  robots: { index: false },
};

type Q = { id?: string | string[]; n?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function HandoffPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const n = Math.min(9, Math.max(1, parseInt(one(q.n), 10) || 1));
  return <HandoffClient id={one(q.id).trim()} travellers={n} />;
}
