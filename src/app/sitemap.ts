import type { MetadataRoute } from 'next';
import { data } from '@/lib/engine/data';
import { SITE_URL } from '@/lib/site';

// Every indexable route, absolute. /rules changes when the rules are rechecked, so it carries that date.
export default function sitemap(): MetadataRoute.Sitemap {
  const rulesDate = new Date(`${data.rulesCheckedOn}T00:00:00Z`);
  return [
    { url: `${SITE_URL}/`, lastModified: rulesDate },
    { url: `${SITE_URL}/plan`, lastModified: rulesDate },
    { url: `${SITE_URL}/calculator`, lastModified: rulesDate },
    { url: `${SITE_URL}/transfers`, lastModified: rulesDate },
    { url: `${SITE_URL}/start`, lastModified: rulesDate },
    { url: `${SITE_URL}/rules`, lastModified: rulesDate },
  ];
}
