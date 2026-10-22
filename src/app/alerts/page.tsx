import type { Metadata } from 'next';
import AlertsClient from './AlertsClient';

// Personal page behind sign-in, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Alerts',
  description: 'Watch a route and get told when award seats open. Alerts check our saved results once a day, so they can run a day behind the airline.',
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return <AlertsClient />;
}
