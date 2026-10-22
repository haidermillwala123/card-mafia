import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { BANKS, data } from '@/lib/engine/data';
import Onboarding from './Onboarding';

export const metadata: Metadata = {
  title: 'Set up your cards',
  description: 'Tell Card Mafia your name, home airport, banks, cards and balances once. Your answers stay on this device unless you choose to save them to an account.',
  alternates: { canonical: '/start' },
};

// The sign-up flow: the plane takes off as you answer and lands when you finish. Signed-out visitors to app screens arrive here.
export default function StartPage() {
  const cards = data.cards.map(c => ({ id: c.id, name: c.name, bankId: c.bank, programmeId: c.programme }));
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Set up', href: '/start' }]} />
      <Onboarding banks={BANKS} cards={cards} programmes={Object.fromEntries(data.programmes.map(p => [p.id, p.name]))} />
    </>
  );
}
