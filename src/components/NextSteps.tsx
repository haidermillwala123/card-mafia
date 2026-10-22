'use client';

// A "Where next" row at the bottom of every working screen, so no page is a dead end. One map, matched on the longest path prefix.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Step = [href: string, label: string];
const NEXT: Record<string, Step[]> = {
  '/flights/checkout': [['/trips', 'Upcoming trips'], ['/alerts', 'Watch this route'], ['/flights', 'Search again']],
  '/flights/handoff': [['/trips', 'Upcoming trips'], ['/alerts', 'Watch this route'], ['/flights', 'Search again']],
  '/flights/compare': [['/flights', 'Back to search'], ['/trips', 'Upcoming trips'], ['/wallet', 'Your wallet']],
  '/flights': [['/trips/ideas', 'Trips you can take'], ['/alerts', 'Watch a route'], ['/wallet', 'Your wallet']],
  '/wallet': [['/trips/ideas', 'Trips you can take'], ['/cards/recommend', 'Best card for you'], ['/flights', 'Search for trips']],
  '/transfers': [['/flights', 'Search for trips'], ['/wallet', 'Your wallet'], ['/earn/calculator', 'Points calculator']],
  '/earn/calculator': [['/cards/recommend', 'Best card for you'], ['/earn', 'Best way to earn'], ['/wallet', 'Your wallet']],
  '/earn': [['/cards/recommend', 'Best card for you'], ['/earn/calculator', 'Points calculator'], ['/wallet', 'Your wallet']],
  '/cards/recommend': [['/cards/statement', 'Use a statement'], ['/earn', 'How cards earn'], ['/wallet', 'Add it to your wallet']],
  '/cards/statement': [['/cards/recommend', 'Best card for you'], ['/wallet', 'Your wallet'], ['/earn/calculator', 'Points calculator']],
  '/calculator': [['/transfers', 'Transfers'], ['/flights', 'Search for trips'], ['/wallet', 'Your wallet']],
  '/trips/ideas': [['/flights', 'Search for trips'], ['/wallet', 'Your wallet'], ['/alerts', 'Alerts']],
  '/trips': [['/flights', 'Search for trips'], ['/alerts', 'Alerts'], ['/trips/ideas', 'Trips you can take']],
  '/alerts': [['/flights', 'Search for trips'], ['/trips', 'Upcoming trips'], ['/trips/ideas', 'Trips you can take']],
  '/plan': [['/trips', 'Upcoming trips'], ['/flights', 'Search for trips'], ['/wallet', 'Your wallet']],
  '/learn': [['/flights', 'Search for trips'], ['/wallet', 'Your wallet'], ['/earn', 'Best way to earn']],
  '/account': [['/wallet', 'Your wallet'], ['/trips', 'Upcoming trips'], ['/alerts', 'Alerts']],
};
const KEYS = Object.keys(NEXT).sort((a, b) => b.length - a.length);

export default function NextSteps() {
  const path = usePathname();
  const key = KEYS.find(k => path === k || path.startsWith(`${k}/`));
  if (!key) return null;
  return (
    <nav className="nxt" aria-label="Where next">
      <span>Where next</span>
      {NEXT[key].map(([href, label]) => <Link key={href} href={href}>{label}<i aria-hidden="true">→</i></Link>)}
    </nav>
  );
}
