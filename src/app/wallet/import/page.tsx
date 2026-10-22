import type { Metadata } from 'next';
import ImportClient from './ImportClient';

// Personal page behind sign-in, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Import points from Gmail',
  description: 'Read your bank and airline emails once and fill in your card and loyalty balances.',
  robots: { index: false, follow: false },
};

export default function ImportPage() {
  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Wallet</span>
        <h1 className="a-hd a-sm">Fill your wallet<br /><em>from your inbox.</em></h1>
        <ImportClient />
      </div>
    </div>
  );
}
