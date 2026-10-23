'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Ic from '@/components/app/Icons';
import { Note, Tag } from '@/components/app/ui';
import CopyButton from '@/components/CopyButton';
import { MCP_URL } from '@/lib/site';
import { listAlerts, listWatches } from '@/lib/app/alerts';
import { listTrips } from '@/lib/app/trips';
import { useWallet } from '@/lib/app/wallet';
import { recordInterest, type Period } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import './account.css';

type Msg = { kind: 'success' | 'danger'; title: string; text?: string };

export default function Account() {
  const router = useRouter();
  const { user, profile, update } = useWallet();
  const [period, setPeriod] = useState<Period>('yearly');
  const [onList, setOnList] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!user || !sb) return;
    sb.from('plan_interest').select('tier,billing_period').order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      const row = data?.[0];
      if (row?.tier === 'pro') {
        setOnList(true);
        if (row.billing_period) setPeriod(row.billing_period as Period);
      }
    });
  }, [user]);

  async function joinList() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    // Same as before: clear the earlier answer, then record the new one.
    await supabase()?.from('plan_interest').delete().eq('user_id', user.id);
    const r = await recordInterest('pro', period);
    setBusy(false);
    if (r === 'error') return setMsg({ kind: 'danger', title: 'We could not save that.', text: 'Nothing was changed. Try again.' });
    setOnList(true);
    update({ ...profile, plan: 'pro', period });
    setMsg({ kind: 'success', title: 'You are on the Pro list.', text: 'We will email you if Pro opens. Nothing was charged.' });
  }

  async function leaveList() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    const { error } = (await supabase()?.from('plan_interest').delete().eq('user_id', user.id)) ?? { error: true };
    setBusy(false);
    if (error) return setMsg({ kind: 'danger', title: 'We could not save that.', text: 'Nothing was changed. Try again.' });
    setOnList(false);
    update({ ...profile, plan: 'free' });
    setMsg({ kind: 'success', title: 'You are off the Pro list.', text: 'You stay on Free. Everything stays available.' });
  }

  async function exportData() {
    setBusy(true);
    setMsg(null);
    try {
      const [trips, watches, alerts] = await Promise.all([listTrips(), listWatches(), listAlerts(200)]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), email: user?.email, profile, trips, watches, alerts }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'card-mafia-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ kind: 'danger', title: 'We could not build the export.', text: 'Nothing was changed. Try again.' });
    }
    setBusy(false);
  }

  async function signOut() {
    await supabase()?.auth.signOut();
    router.push('/home');
  }

  const head = (
    <>
      <span className="a-eb">Account</span>
      <h1 className="a-hd a-sm">You, your data,<br /><em>your plan.</em></h1>
    </>
  );

  if (user === null && !supabase()) {
    return <div className="a-pg"><div className="a-body">{head}<Note kind="info" title="Sign-in is not switched on for this copy.">Everything else works without an account.</Note></div></div>;
  }
  if (!user) {
    return (
      <div className="a-pg"><div className="a-body">
        {head}
        <Note kind="info" title="You are not signed in.">
          <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in with an email code</Link> to see your account. Search works without one.
        </Note>
      </div></div>
    );
  }

  return (
    <div className="a-pg"><div className="a-body">
      {head}
      {msg && <Note kind={msg.kind} title={msg.title}>{msg.text}</Note>}
      <div className="a-g2" style={{ alignItems: 'start' }}>
        <div className="a-gl a-sel">
          <span className="a-cap">Signed in</span>
          <div className="a-kv"><span>Email</span><b className="a-account-mono">{user.email}</b></div>
          <div className="a-kv"><span>Plan</span><b>Free</b></div>
          <span className="a-mu">Free covers search, compare and the calculator. Sign-in adds wallet, trips and alerts.</span>
          <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" style={{ alignSelf: 'flex-start' }} onClick={signOut}>Sign out</button>
        </div>

        <div className="a-gl">
          <div className="a-r"><span className="a-cap a-g">Pro</span><Tag kind="outline" plain>Preview</Tag></div>
          <b className="a-t">Pro is not on sale yet.</b>
          <span className="a-mu">We are still talking to people about what it should include. Nothing here is a promise of data access or a price.</span>
          <div className="a-account-actions" role="group" aria-label="What would you pay for">
            <button type="button" className={`a-pill${period === 'monthly' ? ' a-on' : ''}`} aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</button>
            <button type="button" className={`a-pill${period === 'yearly' ? ' a-on' : ''}`} aria-pressed={period === 'yearly'} onClick={() => setPeriod('yearly')}>Yearly</button>
          </div>
          <div className="a-account-actions">
            <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={busy} onClick={joinList}>{onList ? 'Update what I would pay for' : 'Tell us what you would pay for'}</button>
            {onList && <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" disabled={busy} onClick={leaveList}>Remove me from the list</button>}
          </div>
          <span className="a-mu">{onList ? 'You are on the Pro list. You will hear from us only if Pro opens.' : 'This only records your interest. No payment is taken.'}</span>
        </div>

        <div className="a-gl">
          <span className="a-cap">Your data</span>
          <span className="a-mu">Your wallet, trips and alerts. Nothing else.</span>
          <div className="a-account-actions">
            <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={busy} onClick={exportData}>Export my data</button>
          </div>
          <span className="cm-stamp"><Ic name="lock" small />We never ask for bank logins or card numbers.</span>
        </div>

        <div className="a-gl">
          <span className="a-cap">Connect with MCP</span>
          <b className="a-t">Use Card Mafia from Claude or ChatGPT.</b>
          <span className="a-mu">Add this address as a custom connector. It needs no sign-in.</span>
          <code className="a-account-mono" style={{ wordBreak: 'break-all' }}>{MCP_URL}</code>
          <div className="a-account-actions">
            <CopyButton value={MCP_URL} label="Copy address" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" />
            <Link className="cm-btn cm-btn--ghost cm-btn--sm" href="/developers">Setup steps</Link>
          </div>
          <span className="a-mu">It does not read your saved wallet or trips. It only uses the cards and balances you type into the chat.</span>
        </div>
      </div>
      <div className="a-foot">
        <Link className="a-cap" href="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy</Link>
        <Link className="a-cap" href="/about" style={{ color: 'var(--text-muted)' }}>About</Link>
        <span className="a-g" />
        <span className="a-cap">Card Mafia does not book flights and is not affiliated with banks or airlines.</span>
      </div>
    </div></div>
  );
}
