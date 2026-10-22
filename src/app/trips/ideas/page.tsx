import type { Metadata } from 'next';
import IdeasClient from './IdeasClient';
import '../../home/home.css';

// Personal page behind sign-in, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Trips you can take',
  description: 'Seats your own cards and balances can pay for, by region.',
  robots: { index: false, follow: false },
};

export default function IdeasPage() {
  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Trips</span>
        <h1 className="a-hd a-sm">Trips you can take<br /><em>with your points.</em></h1>
        <IdeasClient />
      </div>
    </div>
  );
}
