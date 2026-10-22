import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'More', robots: { index: false } };

const ROWS = [
  { href: '/plan', label: 'Plan', hint: 'Top 3 plans' },
  { href: '/wallet', label: 'Wallet', hint: 'Your cards and points' },
  { href: '/transfers', label: 'Transfers', hint: 'Ratios, caps and routes' },
  { href: '/earn', label: 'Earn', hint: 'How your cards earn' },
  { href: '/trips', label: 'Trips', hint: 'Saved plans' },
  { href: '/alerts', label: 'Alerts', hint: 'Watched routes' },
  { href: '/learn', label: 'Learn', hint: 'Glossary and tools' },
  { href: '/account', label: 'Account', hint: 'Sign in and your data' },
];

// Phone destination behind the "More" tab. On a desktop the same links sit in the top bar.
export default function More() {
  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">More</span>
        <h1 className="a-hd a-sm">
          Everything
          <br />
          <em>else.</em>
        </h1>
        <div className="a-gl" style={{ padding: '8px 16px' }}>
          {ROWS.map(r => (
            <Link key={r.href} href={r.href} className="a-mrow">
              {r.label}
              <small>{r.hint}</small>
            </Link>
          ))}
        </div>
        <p className="a-cap">Search works without an account. Wallet, Trips and Alerts need an email sign-in.</p>
      </div>
    </div>
  );
}
