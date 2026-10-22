'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Ic from './Icons';

// Phone only (CSS hides it above 760px): the three-item bottom bar from the design system.
export default function MobileBar() {
  const path = usePathname();
  const items = [
    { href: '/home', label: 'Home', icon: 'home' as const, on: path === '/home' },
    { href: '/flights', label: 'Search', icon: 'search' as const, on: path.startsWith('/flights') },
    { href: '/more', label: 'More', icon: 'more' as const, on: !(path === '/home' || path.startsWith('/flights')) && path !== '/' },
  ];
  return (
    <nav className="cm-bottombar a-mobilebar" aria-label="Main">
      {items.map(i => (
        <Link key={i.href} href={i.href} className="cm-bottombar__item" aria-current={i.on ? 'page' : undefined}>
          <Ic name={i.icon} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
