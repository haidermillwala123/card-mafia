import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Type one sentence about your trip. Card Mafia finds award seats on cached data and shows which of your cards can pay for them.',
  alternates: { canonical: '/home' },
};

export default function HomePage() {
  return <HomeClient />;
}
