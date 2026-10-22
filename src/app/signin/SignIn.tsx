'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import EmailCode from '@/components/EmailCode';
import { pullProfile, useUser } from '@/lib/auth';
import { saveProfile } from '@/lib/profile';

export default function SignIn() {
  const router = useRouter();
  const user = useUser();
  const [note, setNote] = useState('');

  async function done() {
    const p = await pullProfile();
    if (p) saveProfile(p);
    setNote(p ? 'Signed in. Your saved setup is on this device.' : 'Signed in.');
    router.push(p?.cardIds.length ? '/plan' : '/start');
  }

  return (
    <div className="container flow">
      <div className="stack" style={{ ['--stack' as string]: '20px', maxWidth: 520 }}>
        <h1 className="t-h1">Sign in</h1>
        <p className="t-lg muted">Use your email to get your saved cards and balances back on this device. New here? The same form creates your account.</p>
        {user ? (
          <div className="note note-ok" role="status">You are signed in as {user.email}. <a href="/account">Open your account</a>.</div>
        ) : (
          <EmailCode onVerified={done} />
        )}
        {note && <p className="t-sm muted" role="status">{note}</p>}
        <p className="t-sm muted">No account is needed to use Card Mafia. Everything works without one.</p>
      </div>
    </div>
  );
}
