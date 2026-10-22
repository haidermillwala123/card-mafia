'use client';

// Connect Gmail, scan once, review what was found, and apply only what the person ticks.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import FlightLoader from '@/components/FlightLoader';
import Select from '@/components/Select';
import { Note } from '@/components/app/ui';
import { bankName, CARDS, cardName } from '@/lib/app/catalog';
import { dateShort, fmt } from '@/lib/app/format';
import type { Finding } from '@/lib/gmail-parse';
import { useWallet } from '@/lib/app/wallet';
import Loyalty, { loyaltyName, saveLoyalty } from '../Loyalty';

const ERRORS: Record<string, string> = {
  'not-configured': 'Gmail import is not switched on for this copy of the app yet.',
  denied: 'Google did not give access, so nothing was read.',
  state: 'That sign-in link expired. Start again.',
  token: 'Google would not complete the connection. Start again.',
};

type Row = { f: Finding; on: boolean; cardId: string };

export default function ImportClient() {
  const w = useWallet();
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review' | 'done'>('idle');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [scanned, setScanned] = useState(0);
  const [applied, setApplied] = useState(0);
  const [bump, setBump] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const e = q.get('error');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e) setError(ERRORS[e] ?? 'Something went wrong. Start again.');
    if (q.get('connected') !== '1') return;
    window.history.replaceState(null, '', '/wallet/import'); // a refresh must not scan again with a spent token
    setPhase('scanning');
    fetch('/api/gmail/scan', { method: 'POST' })
      .then(async r => ({ ok: r.ok, j: (await r.json().catch(() => null)) as { findings?: Finding[]; scanned?: number; error?: string } | null }))
      .then(({ ok, j }) => {
        if (!ok || !j?.findings) { setError(j?.error ?? 'We could not read your mail. Start again.'); setPhase('idle'); return; }
        setScanned(j.scanned ?? 0);
        setRows(j.findings.map(f => ({ f, on: true, cardId: f.cardId ?? '' })));
        setPhase('review');
      })
      .catch(() => { setError('We could not reach the server. Start again.'); setPhase('idle'); });
  }, []);

  const held = useMemo(() => new Set(w.profile.cardIds), [w.profile.cardIds]);
  // cards of a bank, the ones you hold first
  const optionsFor = (bank: string) => CARDS.filter(c => c.bank === bank).sort((a, b) => Number(held.has(b.id)) - Number(held.has(a.id)));

  // a bank row with no card named picks your only card at that bank, if you hold exactly one
  useEffect(() => {
    if (phase !== 'review' || !w.ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(rs => rs.map(r => (r.f.kind === 'bank' && !r.cardId ? { ...r, cardId: optionsFor(r.f.bank!).filter(c => held.has(c.id)).length === 1 ? optionsFor(r.f.bank!)[0].id : '' } : r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, w.ready]);

  const ready = rows.filter(r => r.on && (r.f.kind === 'programme' || r.cardId));
  const set = (i: number, p: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));

  async function apply() {
    let n = 0;
    const cardRows = ready.filter(r => r.f.kind === 'bank');
    if (cardRows.length) {
      const next = { ...w.profile, cardIds: [...w.profile.cardIds], bankIds: [...w.profile.bankIds], balances: { ...w.profile.balances } };
      for (const r of cardRows) {
        if (!next.cardIds.includes(r.cardId)) next.cardIds.push(r.cardId);
        const bank = CARDS.find(c => c.id === r.cardId)?.bank;
        if (bank && !next.bankIds.includes(bank)) next.bankIds.push(bank);
        next.balances[r.cardId] = r.f.balance;
        n++;
      }
      w.update(next);
      await w.save(next);
    }
    const loyalty = ready.filter(r => r.f.kind === 'programme');
    if (loyalty.length && w.user) {
      if (await saveLoyalty(w.user.id, loyalty.map(r => ({ programmeId: r.f.programmeId!, balance: r.f.balance })))) n += loyalty.length;
      else setError('We saved your cards, but could not save the loyalty balances. Try again.');
    }
    setApplied(n);
    setBump(b => b + 1);
    setPhase('done');
  }

  if (!w.ready) return <FlightLoader label="Loading your wallet" />;
  if (!w.user) return <Note kind="info" title="Sign in first.">Importing needs an account so the balances can be saved. <Link href="/signin?next=/wallet/import" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in</Link></Note>;

  return (
    <div className="a-c" style={{ gap: 16 }}>
      {error && <Note kind="danger" title="Not connected.">{error}</Note>}

      {phase === 'idle' && (
        <div className="a-gl" style={{ gap: 14 }}>
          <b>Connect Gmail once. We find your balances.</b>
          <ul className="imp-list">
            <li>Read-only. We cannot send, delete or change anything.</li>
            <li>We only look at mail from banks and airlines we know, from the last two years.</li>
            <li>Nothing is saved until you tick it. Email text is never stored, and access ends right after the scan.</li>
          </ul>
          <a className="a-cta" style={{ alignSelf: 'flex-start' }} href="/api/gmail/start">Connect Gmail</a>
        </div>
      )}

      {phase === 'scanning' && <div className="a-gl"><FlightLoader label="Reading your bank and airline emails. This takes up to a minute." /></div>}

      {phase === 'review' && (
        rows.length === 0 ? (
          <div className="a-gl a-dashed" style={{ alignItems: 'flex-start', gap: 10 }}>
            <b>No balances found.</b>
            <span className="a-mu">We looked at {scanned} {scanned === 1 ? 'email' : 'emails'}. Banks and airlines word these differently, so add balances by hand in Wallet.</span>
            <Link className="a-cta" href="/wallet">Open Wallet</Link>
          </div>
        ) : (
          <>
            <span className="a-mu">Found {rows.length} from {scanned} emails. Tick what is right, then save.</span>
            <div className="a-gl imp-rows">
              {rows.map((r, i) => (
                <div className="imp-row" key={r.f.key}>
                  <input type="checkbox" checked={r.on} onChange={e => set(i, { on: e.target.checked })} aria-label={`Use ${r.f.kind === 'bank' ? bankName(r.f.bank!) : loyaltyName(r.f.programmeId!)}`} />
                  <div className="imp-what">
                    <b>{r.f.kind === 'bank' ? `${bankName(r.f.bank!)} reward points` : loyaltyName(r.f.programmeId!)}</b>
                    <small>{r.f.from} · {dateShort(r.f.date)} · {r.f.subject}</small>
                  </div>
                  {r.f.kind === 'bank' && (
                    <div className="imp-card">
                      <Select value={r.cardId} onChange={e => set(i, { cardId: e.target.value })}>
                        <option value="">Which card?</option>
                        {optionsFor(r.f.bank!).map(c => <option key={c.id} value={c.id}>{cardName(c.id)}{held.has(c.id) ? '' : ' (add)'}</option>)}
                      </Select>
                    </div>
                  )}
                  <b className="a-mono imp-bal">{fmt(r.f.balance)}</b>
                </div>
              ))}
            </div>
            <div className="a-r a-rw">
              <button type="button" className="a-cta" disabled={ready.length === 0} onClick={apply}>Save {ready.length} to my wallet</button>
              {rows.some(r => r.on && r.f.kind === 'bank' && !r.cardId) && <span className="a-mu">Pick a card for each bank row to save it.</span>}
            </div>
          </>
        )
      )}

      {phase === 'done' && (
        <div className="a-gl" style={{ gap: 10 }}>
          <b>{applied} {applied === 1 ? 'balance' : 'balances'} saved.</b>
          <div className="a-r a-rw">
            <Link className="a-cta" href="/wallet">See your wallet</Link>
            <Link className="cm-btn cm-btn--secondary" href="/trips/ideas">Trips you can take</Link>
          </div>
        </div>
      )}

      <Loyalty refresh={bump} />
    </div>
  );
}
