import type { Metadata } from 'next';
import TripsClient from './TripsClient';

// Personal page behind sign-in, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Trips',
  description: 'Your saved plans and where each one stands. You set the status yourself. Card Mafia cannot see your bookings.',
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return <TripsClient />;
}
