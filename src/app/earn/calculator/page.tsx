import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import EarnCalculator from '../EarnCalculator';
import { loadEarn } from '../data';
import '../earn.css';
import '@/app/cards/recommend/recommend.css';

export const metadata: Metadata = {
  title: 'Points calculator: what your monthly spend earns',
  description: 'Type a typical month of spending and see which of 58 Indian premium cards earns the most points, and the airline miles they become.',
  alternates: { canonical: '/earn/calculator' },
};
export const revalidate = 300;

export default async function PointsCalculatorPage() {
  const { calc, programmes, miles } = await loadEarn();
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Earn points', href: '/earn' }, { name: 'Points calculator', href: '/earn/calculator' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '20px', paddingBottom: 'var(--space-2xl)' }}>
        <div className="ef-title">
          <h1 className="t-h1">Points calculator</h1>
          <Link className="cm-btn cm-btn--secondary" href="/earn">Browse card earn rules</Link>
        </div>
        <EarnCalculator cards={calc} programmes={programmes} miles={miles} />
      </div>
    </>
  );
}
