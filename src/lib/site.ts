// Canonical origin. On Vercel the production domain is injected; locally it falls back to localhost.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? (vercel ? `https://${vercel}` : 'http://localhost:3000')).replace(/\/$/, '');
export const SITE_NAME = 'Card Mafia';
