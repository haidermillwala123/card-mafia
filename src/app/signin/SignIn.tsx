'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmailCode from '@/components/EmailCode';
import { Note } from '@/components/app/ui';
import { pullProfile, useUser } from '@/lib/auth';
import { saveProfile } from '@/lib/profile';

export default function SignIn() {
  const router = useRouter();
  const user = useUser();

  async function done() {
    const p = await pullProfile();
    if (p) saveProfile(p);
    const next = new URLSearchParams(window.location.search).get('next');
    router.push(next && /^\/[^/\\]/.test(next) ? next : '/home');
  }

  return (
    <div className="a-pg"><div className="a-body">
      <span className="a-eb">Sign in</span>
      <h1 className="a-hd a-sm">Sign in with<br /><em>an email code.</em></h1>
      <p className="a-lead">Use your email to get your saved cards and balances back on this device. New here? The same form creates your account.</p>
      <div style={{ maxWidth: 520 }}>
        {user ? (
          <Note kind="success" title={`You are signed in as ${user.email}.`}>
            <Link href="/home" style={{ color: 'inherit', textDecoration: 'underline' }}>Go to home</Link>
          </Note>
        ) : (
          <div className="a-gl"><EmailCode onVerified={done} /></div>
        )}
      </div>
      <Note kind="info" title="Search works without an account.">Sign in only to save a wallet, trips or alerts.</Note>
    </div></div>
  );
}
