import Link from 'next/link';
import JsonLd from './JsonLd';
import { SITE_URL } from '@/lib/site';

export default function Breadcrumbs({ trail }: { trail: { name: string; href: string }[] }) {
  const all = [{ name: 'Home', href: '/' }, ...trail];
  return (
    <nav className="container crumbs" aria-label="Breadcrumb">
      <ol>
        {all.map((c, i) => (
          <li key={c.href}>{i === all.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.href}>{c.name}</Link>}</li>
        ))}
      </ol>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.href === '/' ? '' : c.href}` })),
        }}
      />
    </nav>
  );
}
