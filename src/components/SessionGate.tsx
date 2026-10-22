'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Only screens that hold personal data need an account. Search and plans work for anyone.
const PROTECTED = ['/home', '/wallet', '/trips', '/alerts'];

// Kept so the sign-in code does not need to change; the saved login now lasts across browser sessions.
export const markLive = () => {};

// Keeps the personal screens behind sign-in. A saved login stays until the person signs out.
export default function SessionGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useUser();
  const protectedPath = PROTECTED.some(p => path === p || path.startsWith(`${p}/`));
  const sb = supabase();

  useEffect(() => {
    if (protectedPath && sb && user === null) router.replace(`/signin?next=${encodeURIComponent(path)}`);
  }, [user, path, protectedPath, sb, router]);

  // Without Supabase there is nothing to sign in to, so the app stays open.
  if (!sb || !protectedPath) return <>{children}</>;
  return user ? <>{children}</> : <div className="a-pg"><div className="a-body"><p className="muted" role="status">{user === undefined ? 'Checking your sign-in…' : 'Taking you to sign in…'}</p></div></div>;
}
