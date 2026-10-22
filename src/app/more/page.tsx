import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Menu', robots: { index: false } };

// Phone destination behind the "Menu" tab. On a desktop the same groups are the Cards, Trips and More menus in the top bar.
const SECTIONS = [
  { title: 'Cards', rows: [
    { href: '/cards/recommend', label: 'Best card for you', hint: 'From what you spend' },
    { href: '/earn', label: 'Best way to earn', hint: 'Filter 58 cards' },
    { href: '/wallet', label: 'Wallet', hint: 'Your cards and balances' },
    { href: '/transfers', label: 'Transfers', hint: 'Ratios, caps and routes' },
    { href: '/earn/calculator', label: 'Points calculator', hint: 'What your spend earns' },
  ] },
  { title: 'Trips', rows: [
    { href: '/flights', label: 'Search for trips', hint: 'Every seat from India' },
    { href: '/trips/ideas', label: 'Trips you can take', hint: 'With the points you have' },
    { href: '/trips', label: 'Upcoming trips', hint: 'Your saved plans' },
    { href: '/plan', label: 'Plan a trip', hint: 'Top 3 plans' },
  ] },
  { title: 'More', rows: [
    { href: '/account', label: 'Profile settings', hint: 'Your details and data' },
    { href: '/alerts', label: 'Alerts', hint: 'Routes we watch for you' },
    { href: '/learn', label: 'Glossary and guides', hint: 'Terms and tools' },
    { href: '/home?tour=1', label: 'Take the tour', hint: 'Where everything is' },
  ] },
];

export default function More() {
  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Menu</span>
        {SECTIONS.map(s => (
          <section key={s.title} className="a-c">
            <h2 className="a-sec">{s.title}</h2>
            <div className="a-gl" style={{ padding: '8px 16px' }}>
              {s.rows.map(r => (
                <Link key={r.href} href={r.href} className="a-mrow">
                  {r.label}
                  <small>{r.hint}</small>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
