import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_URL } from '@/lib/site';

// The landing page is the hand-built page in public/landing. It is served at "/" with the real origin filled into
// its canonical, Open Graph and JSON-LD tags, and it is built once, so it stays static and fast.
export const dynamic = 'force-static';

export function GET() {
  const html = readFileSync(join(process.cwd(), 'public/landing/index.html'), 'utf8').replaceAll('__SITE__', SITE_URL);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}
