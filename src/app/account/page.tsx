import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import { data } from '@/lib/engine/data';
import Account from './Account';

// Private page: it shows nothing until the person signs in, and it should stay out of search results.
export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Your account', href: '/account' }]} />
      <Account programmeOfCard={Object.fromEntries(data.cards.map(c => [c.id, c.programme]))} />
    </>
  );
}
