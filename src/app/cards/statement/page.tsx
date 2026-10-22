import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { loadEarn } from '@/app/earn/data';
import StatementClient from './StatementClient';
import './statement.css';

export const metadata: Metadata = {
  title: 'Find the best card for your spending from a statement',
  description: 'Upload a credit card statement PDF or paste your transactions. See what you spend by category and which card earns the most on each.',
  alternates: { canonical: '/cards/statement' },
};
export const revalidate = 300;

export default async function StatementPage() {
  const { browse, calc, programmes, miles } = await loadEarn();
  const fees = Object.fromEntries(browse.map(c => [c.id, c.annualFee]));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Cards', href: '/earn' }, { name: 'From your statement', href: '/cards/statement' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '20px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Which card fits how you spend?</h1>
        <p className="muted measure">Add a statement and we sort your spending, then show the best card for each kind of spend.</p>
        <StatementClient cards={calc} fees={fees} programmes={programmes} miles={miles} />
      </div>
    </>
  );
}
