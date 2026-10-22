'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const PROTECTED = ['/home', '/plan', '/flights', '/wallet', '/trips', '/alerts'];
const COOKIE = 'cm_live';

// A session cookie (no max-age): gone when the browser closes, so every new browser session asks for a sign-in again.
export const markLive = () => {
  document.cookie = `${COOKIE}=1; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
};
const isLive = () => document.cookie.split('; ').some(c => c === `${COOKIE}=1`);

// Keeps the app screens behind sign-in and asks again in every new browser session.
export default function SessionGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useUser();
  const [ready, setReady] = useState(false);
  const protectedPath = PROTECTED.some(p => path === p || path.startsWith(`${p}/`));
  const sb = supabase();

  useEffect(() => {
    if (user === undefined || !sb) return;
    let cancelled = false;
    (async () => {
      // shortcut: a saved login from an earlier browser session is ended here and the device-only profile stays; upgrade if the cookie moves server-side.
      if (user && !isLive()) await sb.auth.signOut({ scope: 'local' });
      if (cancelled) return;
      if (protectedPath && (!user || !isLive())) router.replace(`/signin?next=${encodeURIComponent(path)}`);
      else setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user, path, protectedPath, sb, router]);

  // Without Supabase there is nothing to sign in to, so the app stays open.
  if (!sb || !protectedPath) return <>{children}</>;
  return ready && user ? <>{children}</> : <div className="a-pg"><div className="a-body"><p className="muted" role="status">Checking your sign-in…</p></div></div>;
}
