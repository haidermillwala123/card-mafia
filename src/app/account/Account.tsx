'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PlanPicker from '@/components/PlanPicker';
import { Check, Warn } from '@/components/Icons';
import { pushProfile, recordInterest, useUser, type Period, type Tier } from '@/lib/auth';
import { EMPTY_PROFILE, loadProfile, saveProfile, type Profile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export default function Account({ programmeOfCard }: { programmeOfCard: Record<string, string> }) {
  const user = useUser();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [tier, setTier] = useState<Tier>('free');
  const [period, setPeriod] = useState<Period>('yearly');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Device storage and the account can only be read after mount: reading them during render would not match the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = loadProfile();
    if (p) {
      setProfile(p);
      setTier(p.plan);
      setPeriod(p.period);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    sb.from('plan_interest').select('tier,billing_period').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      const row = data?.[0];
      if (row) {
        setTier(row.tier as Tier);
        if (row.billing_period) setPeriod(row.billing_period as Period);
      }
    });
  }, [user]);

  async function savePlan() {
    setBusy(true);
    setMsg(null);
    const sb = supabase();
    await sb?.from('plan_interest').delete().eq('user_id', user!.id);
    const r = tier === 'pro' ? await recordInterest(tier, period) : 'saved';
    const next = { ...profile, plan: tier, period };
    saveProfile(next);
    setProfile(next);
    setBusy(false);
    setMsg(r === 'error' ? { kind: 'bad', text: 'We could not save that. Try again.' } : { kind: 'ok', text: tier === 'pro' ? 'You are on the Pro list. We will email you when it opens. Nothing was charged.' : 'You are on Free. Everything stays available.' });
  }

  async function saveSetup() {
    setBusy(true);
    setMsg(null);
    const ok = await pushProfile(profile, programmeOfCard);
    setBusy(false);
    setMsg(ok ? { kind: 'ok', text: 'Your setup is saved to your account.' } : { kind: 'bad', text: 'We could not save your setup. Try again.' });
  }

  async function signOut() {
    await supabase()?.auth.signOut();
  }

  if (user === undefined) return <div className="container flow"><p className="muted" role="status"><span className="spin" /> Loading</p></div>;
  if (!user) {
    return (
      <div className="container flow stack" style={{ ['--stack' as string]: '16px', maxWidth: 520 }}>
        <h1 className="t-h1">Your account</h1>
        <p className="t-lg muted">Sign in with your email to see your saved setup and your plan choice. No account is needed to use Card Mafia.</p>
        <div className="btn-row"><Link className="btn btn-primary" href="/signin">Sign in</Link><Link className="btn btn-secondary" href="/plan">Build a plan</Link></div>
      </div>
    );
  }

  return (
    <div className="container flow">
      <div className="stack" style={{ ['--stack' as string]: '28px', maxWidth: 760 }}>
        <div>
          <h1 className="t-h1">Your account</h1>
          <p className="muted" style={{ marginTop: 8 }}>Signed in as <b style={{ color: 'var(--color-text)' }}>{user.email}</b></p>
        </div>

        {msg && <div className={msg.kind === 'ok' ? 'note note-ok' : 'note note-bad'} role="status">{msg.kind === 'ok' ? <Check /> : <Warn />}{msg.text}</div>}

        <section className="card stack" style={{ ['--stack' as string]: '12px' }} aria-labelledby="setup-h">
          <h2 id="setup-h" className="t-title">Saved setup</h2>
          <p className="t-sm muted">
            {profile.first ? `${profile.first} ${profile.last}`.trim() : 'No name yet'} · home airport {profile.airport || 'not set'} · {profile.cardIds.length} {profile.cardIds.length === 1 ? 'card' : 'cards'} on this device
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" disabled={busy || !profile.first} onClick={saveSetup}>Save this device’s setup to my account</button>
            <Link className="btn btn-ghost" href="/start">Edit setup</Link>
          </div>
        </section>

        <section className="stack" style={{ ['--stack' as string]: '16px' }} aria-labelledby="plan-h">
          <h2 id="plan-h" className="t-title">Your plan</h2>
          <PlanPicker tier={tier} period={period} onTier={setTier} onPeriod={setPeriod} />
          <div className="btn-row"><button type="button" className="btn btn-primary" disabled={busy} onClick={savePlan}>{tier === 'pro' ? 'Join the Pro list' : 'Stay on Free'}</button></div>
        </section>

        <div className="btn-row"><button type="button" className="btn btn-secondary" onClick={signOut}>Sign out</button></div>
      </div>
    </div>
  );
}
