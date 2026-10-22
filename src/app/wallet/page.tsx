import type { Metadata } from 'next';
import WalletClient from './WalletClient';

// Personal page: balances live on the device or the person's account, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Wallet',
  description: 'The cards you hold and the points on each. You type the balances in. Card Mafia never asks for bank logins or card numbers.',
  robots: { index: false, follow: false },
};

export default function WalletPage() {
  return <WalletClient />;
}
