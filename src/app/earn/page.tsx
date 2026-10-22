import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import EarnBrowser from './EarnBrowser';
import { day, earnFile, loadEarn } from './data';
import './earn.css';

export const metadata: Metadata = {
  title: 'How to earn points on every Indian credit card',
  description: 'Base rate, bonus categories, monthly caps, milestones and fees for 58 Indian premium cards, with filters.',
  alternates: { canonical: '/earn' },
};
export const revalidate = 300;

export default async function EarnPage() {
  const { browse, count } = await loadEarn();
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Learn', href: '/learn' }, { name: 'Earn points', href: '/earn' }]} />
      <div className="container stack" style={{ ['--stack' as string]: '20px', paddingBottom: 'var(--space-2xl)' }}>
        <div className="ef-title">
          <div>
            <h1 className="t-h1">How to earn points</h1>
            <p className="muted">{count} cards. Last checked {day(earnFile.checked_on)}. A missing value says &quot;not found&quot;, never zero.</p>
          </div>
          <Link className="cm-btn cm-btn--secondary" href="/earn/calculator">Open the points calculator</Link>
        </div>
        <EarnBrowser cards={browse} />
      </div>
    </>
  );
}
