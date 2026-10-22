'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ic from '@/components/app/Icons';
import { Note } from '@/components/app/ui';
import { BANKS, CARDS, PROGRAMME_OF_CARD, bankName, cardName, programmeName } from '@/lib/app/catalog';
import { fmt } from '@/lib/app/format';
import { useWallet } from '@/lib/app/wallet';
import type { Profile } from '@/lib/profile';
import './wallet.css';

const MAX = 1_000_000_000;

// Cards that share a programme share one balance in the database, so the screen edits one balance per programme.
type Group = { programme: string; cardIds: string[] };

function groupsOf(cardIds: string[]): Group[] {
  const out: Group[] = [];
  for (const id of cardIds) {
    const programme = PROGRAMME_OF_CARD[id] ?? id;
    const g = out.find(x => x.programme === programme);
    if (g) g.cardIds.push(id);
    else out.push({ programme, cardIds: [id] });
  }
  return out;
}

export default function WalletClient() {
  const { ready, user, profile, update, save } = useWallet();
  const [bank, setBank] = useState('');
  const [cardId, setCardId] = useState('');
  const [raw, setRaw] = useState<Record<string, string>>({}); // text being typed, per programme
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'device' | 'error'>('idle');
  const [confirm, setConfirm] = useState<string | null>(null);
  const picker = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get('setup') === '1') picker.current?.focus();
  }, [ready]);

  const groups = useMemo(() => groupsOf(profile.cardIds), [profile.cardIds]);
  const valueOf = (g: Group) => g.cardIds.reduce((s, id) => s + (profile.balances[id] ?? 0), 0);
  const total = groups.reduce((s, g) => s + valueOf(g), 0);
  const bankCards = CARDS.filter(c => c.bank === bank && !profile.cardIds.includes(c.id));

  function change(p: Profile) {
    update(p);
    setStatus('idle');
  }

  function addCard() {
    const c = CARDS.find(x => x.id === cardId);
    if (!c || profile.cardIds.includes(c.id)) return;
    change({ ...profile, cardIds: [...profile.cardIds, c.id], bankIds: profile.bankIds.includes(c.bank) ? profile.bankIds : [...profile.bankIds, c.bank] });
    setCardId('');
  }

  function removeCard(id: string) {
    const cardIds = profile.cardIds.filter(x => x !== id);
    const balances = { ...profile.balances };
    delete balances[id];
    // keep a bank only while one of its cards is held
    const bankIds = profile.bankIds.filter(b => cardIds.some(x => CARDS.find(c => c.id === x)?.bank === b));
    change({ ...profile, cardIds, balances, bankIds });
    setConfirm(null);
  }

  function setBalance(g: Group, text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setRaw(r => ({ ...r, [g.programme]: digits }));
    const n = Math.min(Number(digits || '0'), MAX);
    // the whole programme balance sits on its first card; the others hold zero
    const balances = { ...profile.balances };
    g.cardIds.forEach((id, i) => {
      if (i === 0) balances[id] = n;
      else delete balances[id];
    });
    change({ ...profile, balances });
  }

  async function onSave() {
    setStatus('saving');
    const ok = await save(profile);
    setStatus(user ? (ok ? 'saved' : 'error') : 'device');
  }

  if (!ready) {
    return (
      <div className="a-pg"><div className="a-body">
        <span className="a-eb">Your wallet</span>
        <p className="a-lead" role="status">Loading your cards</p>
      </div></div>
    );
  }

  return (
    <div className="a-pg"><div className="a-body">
      <span className="a-eb">Your wallet</span>
      <h1 className="a-hd">The cards you<br /><em>already hold.</em></h1>
      <p className="a-lead">Balances drive every &quot;can I afford this&quot; on the site. You type them in. We never ask for bank logins or card numbers.</p>

      <div className="a-gl">
        <span className="a-cap">Add a card</span>
        <div className="a-wallet-picker">
          <label className="cm-field"><span className="cm-field__label">Bank</span>
            <span className="cm-control"><select ref={picker} value={bank} onChange={e => { setBank(e.target.value); setCardId(''); }}>
              <option value="">Choose a bank</option>
              {BANKS.map(b => <option key={b.id} value={b.id}>{bankName(b.id)}</option>)}
            </select></span>
          </label>
          <label className="cm-field"><span className="cm-field__label">Card</span>
            <span className="cm-control"><select value={cardId} disabled={!bank} onChange={e => setCardId(e.target.value)}>
              <option value="">{bank ? (bankCards.length ? 'Choose a card' : 'No more cards for this bank') : 'Choose a bank first'}</option>
              {bankCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></span>
          </label>
          <button type="button" className="cm-btn cm-btn--secondary a-pb" disabled={!cardId} onClick={addCard}>Add card</button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="a-gl a-dashed" style={{ alignItems: 'center', textAlign: 'center' }}>
          <b>No cards yet.</b>
          <span className="a-mu">Add a card and a balance.</span>
          <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm a-pb" disabled={status === 'saving'} onClick={onSave}>
            {user ? 'Save to my account' : 'Save on this device'}
          </button>
          {status === 'saved' && <Note kind="success" title="Saved to your account.">Only you can see it.</Note>}
          {status === 'error' && <Note kind="danger" title="We could not save that.">Nothing was changed on your account. Try again.</Note>}
        </div>
      ) : (
        <div className="a-split">
          <div className="a-main a-c" style={{ gap: 12 }}>
            {groups.map(g => {
              const shared = g.cardIds.length > 1;
              const n = valueOf(g);
              const typed = raw[g.programme];
              const shown = typed !== undefined ? (typed === '' ? '' : fmt(Number(typed))) : n ? fmt(n) : '';
              const over = Number(typed ?? n) > MAX;
              const id = `bal-${g.programme}`;
              return (
                <div className="a-gl" key={g.programme}>
                  {g.cardIds.map(cid => {
                    const card = CARDS.find(c => c.id === cid);
                    return (
                      <div className="a-r a-rw" key={cid}>
                        <span className="a-cap">{bankName(card?.bank ?? '')}</span>
                        <b className="a-g">{cardName(cid).replace(bankName(card?.bank ?? ''), '').trim() || cardName(cid)}</b>
                        {confirm === cid ? (
                          <>
                            <span className="a-mu">Remove this card?</span>
                            <button type="button" className="cm-btn cm-btn--danger cm-btn--sm a-pb" onClick={() => removeCard(cid)}>Remove</button>
                            <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(null)}>Keep</button>
                          </>
                        ) : (
                          <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => setConfirm(cid)} aria-label={`Remove ${cardName(cid)}`}>Remove</button>
                        )}
                      </div>
                    );
                  })}
                  <div className="a-dsh" />
                  <label htmlFor={id} className="a-kv"><span>{programmeName(g.programme)} balance</span></label>
                  <div className={`a-wallet-bal${over ? ' a-wallet-bad' : ''}`}>
                    <input id={id} inputMode="numeric" autoComplete="off" placeholder="0" value={shown} onChange={e => setBalance(g, e.target.value)} aria-invalid={over} />
                    <span>pts</span>
                  </div>
                  {over && <span className="a-wallet-err" role="alert">Use a whole number up to {fmt(MAX)}.</span>}
                  {shared && <span className="a-mu">These cards share one {programmeName(g.programme)} balance. Enter it once.</span>}
                </div>
              );
            })}
          </div>
          <div className="a-side a-c" style={{ gap: 16 }}>
            <div className="a-gl">
              <span className="a-cap">Total across cards</span>
              <div className="a-big">{fmt(total)} <small>pts</small></div>
              <span className="a-mu">Cards that share a programme are counted once.</span>
            </div>
            <button type="button" className="a-cta a-full" disabled={status === 'saving' || groups.some(g => valueOf(g) > MAX)} onClick={onSave}>
              {status === 'saving' ? 'Saving' : user ? 'Save to my account' : 'Save on this device'}
              <span className="a-ar"><Ic name="arrow" /></span>
            </button>
            {status === 'saved' && <Note kind="success" title="Saved to your account.">Only you can see it.</Note>}
            {status === 'error' && <Note kind="danger" title="We could not save that.">Nothing was changed on your account. Try again.</Note>}
            {status === 'device' && (
              <Note kind="info" title="Kept on this device only.">
                <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in to keep this on your account</Link>
              </Note>
            )}
            {!user && status !== 'device' && (
              <Note kind="info" title="Sign in to keep this on your account.">
                <Link href="/signin" style={{ color: 'inherit', textDecoration: 'underline' }}>Sign in with an email code</Link>
              </Note>
            )}
          </div>
        </div>
      )}

      <div className="a-foot">
        <span className="a-cap">Balances are what you type. We do not check them with your bank.</span>
        <span className="a-g" />
        <span className="a-cap">We never ask for bank logins or card numbers.</span>
      </div>
    </div></div>
  );
}
