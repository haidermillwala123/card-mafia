import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { loadEarn } from '@/app/earn/data';
import RecommendClient from './RecommendClient';
import '../../earn/calc.css';

export const metadata: Metadata = {
  title: 'Best credit card for you: points and miles from your own spending',
  description: 'Type what you spend in a month and get the three Indian premium cards that earn the most, with the reasons.',
  alternates: { canonical: '/cards/recommend' },
};
export const revalidate = 300;

export default async function RecommendPage() {
  const { browse, calc, programmes, miles } = await loadEarn();
  const fees = Object.fromEntries(browse.map(c => [c.id, c.annualFee]));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Cards', href: '/earn' }, { name: 'Best card for you', href: '/cards/recommend' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '20px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Best card for you</h1>
        <RecommendClient cards={calc} fees={fees} programmes={programmes} miles={miles} />
      </div>
    </>
  );
}
