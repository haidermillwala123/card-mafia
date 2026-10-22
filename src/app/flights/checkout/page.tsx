import type { Metadata } from 'next';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = {
  title: 'Safety check before you transfer',
  description: 'Check the ratio, cap and card path for one award seat before you move any points.',
  robots: { index: false },
};

type Q = { id?: string | string[]; n?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const n = Math.min(9, Math.max(1, parseInt(one(q.n), 10) || 1));
  return <CheckoutClient id={one(q.id).trim()} travellers={n} />;
}
