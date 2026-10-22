import type { Metadata } from 'next';
import CompareClient from './CompareClient';

export const metadata: Metadata = {
  title: 'Compare award seats',
  description: 'Put up to three award seats side by side: points, taxes, the card path and how old the data is.',
  robots: { index: false },
};

type Q = { ids?: string | string[]; n?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ComparePage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const ids = one(q.ids).split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const n = Math.min(9, Math.max(1, parseInt(one(q.n), 10) || 1));
  return <CompareClient ids={ids} travellers={n} />;
}
