import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import JsonLd from '@/components/JsonLd';
import { BANKS } from '@/lib/engine/data';
import { getData } from '@/lib/engine/load';
import { SITE_URL } from '@/lib/site';
import Calculator from './Calculator';

export const metadata: Metadata = {
  title: 'Credit card points calculator for India',
  description: 'See what your HDFC, Axis, Amex, SBI or HSBC points become in Qatar, BA, Finnair and more, including multi-hop transfer chains and monthly caps.',
  alternates: { canonical: '/calculator' },
};
export const revalidate = 300;

export default async function CalculatorPage() {
  const { data } = await getData();
  const cards = data.cards.map(c => ({ id: c.id, name: c.name, bankId: c.bank, bankName: BANKS.find(b => b.id === c.bank)?.name ?? c.bank, programmeId: c.programme }));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Points calculator', href: '/calculator' }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Card Mafia points calculator', url: `${SITE_URL}/calculator`, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', inLanguage: 'en-IN' }} />
      <Calculator cards={cards} programmes={data.programmes} rules={data.rules} />
    </>
  );
}
