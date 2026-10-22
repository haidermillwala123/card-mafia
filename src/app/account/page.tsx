import type { Metadata } from 'next';
import Account from './Account';

// Private page: it shows nothing until the person signs in, and it should stay out of search results.
export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

export default function AccountPage() {
  return <Account />;
}
