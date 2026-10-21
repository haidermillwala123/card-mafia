import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS } from '@/lib/engine/data';
import { getData } from '@/lib/engine/load';
import PlanFlow from './PlanFlow';

export const metadata: Metadata = {
  title: 'Build an award-flight plan',
  description: 'Type your trip and the cards you hold. Card Mafia finds the cheapest points path to a Qsuite seat and checks it before you transfer.',
  alternates: { canonical: '/plan' },
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { data } = await getData();
  const cards = data.cards.map(c => ({ id: c.id, name: c.name, bankId: c.bank, bankName: BANKS.find(b => b.id === c.bank)?.name ?? c.bank }));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Build a plan', href: '/plan' }]} />
      <PlanFlow cards={cards} initialQuery={(q ?? '').slice(0, 700)} />
    </>
  );
}
