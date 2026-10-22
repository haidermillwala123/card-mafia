import type { MetadataRoute } from 'next';
import { getData } from '@/lib/engine/load';
import { SITE_URL } from '@/lib/site';

// Every indexable route, absolute: the fixed pages plus one transfer page per card. The rules date is when the content last changed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await getData();
  const lastModified = new Date(`${data.rulesCheckedOn}T00:00:00Z`);
  const fixed = ['/', '/home', '/learn', '/calculator', '/transfers', '/pricing', '/rules', '/about', '/privacy'];
  return [...fixed.map(p => ({ url: `${SITE_URL}${p}`, lastModified })), ...data.cards.map(c => ({ url: `${SITE_URL}/transfers/${c.id}`, lastModified }))];
}
