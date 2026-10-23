'use client';

import './start.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FlightScene from './FlightScene';
import { nextPath } from './next';
import EmailCode from '@/components/EmailCode';
import PlanPicker from '@/components/PlanPicker';
import { Arrow, Back, Check, Lock } from '@/components/Icons';
import { pushProfile, recordInterest, useUser } from '@/lib/auth';
import type { Finding } from '@/lib/gmail-parse';
import { EMPTY_PROFILE, loadProfile, saveProfile, type Profile } from '@/lib/profile';

const GMAIL_ERRORS: Record<string, string> = {
  'not-configured': 'Gmail import is not switched on yet. Type your balances instead.',
  denied: 'Google did not give access, so nothing was read. Type your balances instead.',
  state: 'That sign-in link expired. Try the Gmail button again.',
  token: 'Google would not complete the connection. Try the Gmail button again.',
};

type Props = {
  banks: { id: string; name: string }[];
  cards: { id: string; name: string; bankId: string; programmeId: string }[];
  programmes: Record<string, string>;
};

const AIRPORTS = ['BOM', 'DEL', 'BLR', 'HYD', 'MAA', 'CCU', 'PNQ', 'AMD'];
const CABINS = [
  { id: 'business', name: 'Business', note: 'Lie-flat seats on long routes', live: true },
  { id: 'first', name: 'First', note: 'Planned for a later version', live: false },
  { id: 'premium_economy', name: 'Premium economy', note: 'Planned for a later version', live: false },
  { id: 'economy', name: 'Economy', note: 'Planned for a later version', live: false },
];
const SAY = ['Check-in is open.', 'Good to meet you.', 'Wheels up.', 'Climbing. Passenger details are nearly done.', 'Cruising altitude. The easy part.', 'Starting our descent.', 'On final. Almost there.', 'Wheels down.', 'At the gate. Two choices left.', 'Cleared for arrival.'];
const n = (x: number) => x.toLocaleString('en-IN');
const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);
const LAST = 9;

export default function Onboarding({ banks, cards, programmes }: Props) {
  const router = useRouter();
  const user = useUser();
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yy, setYy] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const [search, setSearch] = useState(''); // keeps ?next= when someone switches to Sign in
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSearch(window.location.search); }, []);
  const programmeOfCard = Object.fromEntries(cards.map(c => [c.id, c.programmeId]));
  const [gm, setGm] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });

  // Back from Google: read the bank emails once and fill the balance of each card the person already picked. Nothing else is touched.
  async function importFromGmail(base: Profile) {
    setGm({ busy: true, msg: '' });
    const res = await fetch('/api/gmail/scan', { method: 'POST' }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { findings?: Finding[]; error?: string } | null;
    if (!res?.ok || !j?.findings) return setGm({ busy: false, msg: j?.error ?? 'We could not read your mail. Type your balances instead.' });
    const balances = { ...base.balances };
    let filled = 0;
    for (const f of j.findings) {
      if (f.kind !== 'bank') continue;
      const mine = base.cardIds.filter(id => cards.find(c => c.id === id)?.bankId === f.bank);
      const target = f.cardId && base.cardIds.includes(f.cardId) ? f.cardId : mine.length === 1 ? mine[0] : '';
      if (target) { balances[target] = f.balance; filled++; }
    }
    const next = { ...base, balances };
    setP(next);
    saveProfile(next);
    setGm({ busy: false, msg: filled ? `Filled ${filled} ${filled === 1 ? 'card' : 'cards'} from your emails. Check the numbers, then continue.` : 'We found no balances for these cards. Type them instead.' });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Device storage can only be read after mount: reading it during render would not match the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadProfile();
    if (saved) {
      setP(saved);
      const [y, m, d] = (saved.dob || '').split('-');
      setYy(y ?? ''); setMm(m ?? ''); setDd(d ?? '');
    }
    // coming back from the Gmail button: land on the points step again
    const url = new URL(window.location.href);
    const back = url.searchParams.get('gmail') === '1', errCode = url.searchParams.get('gmailerr');
    if (back || errCode) {
      url.searchParams.delete('gmail'); url.searchParams.delete('gmailerr');
      window.history.replaceState(null, '', url.pathname + url.search); // a refresh must not scan again with a spent token
      setI(6);
      if (errCode) setGm({ busy: false, msg: GMAIL_ERRORS[errCode] ?? 'Something went wrong. Type your balances instead.' });
      else if (saved) void importFromGmail(saved);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setP(x => ({ ...x, [k]: v })); setErr(''); };
  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const bankName = (id: string) => banks.find(b => b.id === id)?.name ?? id;
  const dobIso = yy.length === 4 && mm && dd ? `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
  const dobOk = () => {
    if (yy.length !== 4) return false;
    const d = +dd, m = +mm, y = +yy;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 1900 && dt <= new Date();
  };

  const checks: (() => string)[] = [
    () => (p.first.trim() ? '' : 'Add your first name.'),
    () => (p.last.trim() ? '' : 'Add your last name.'),
    () => (dobOk() ? '' : 'We could not read that date. Use day, month and a four-digit year.'),
    () => (/^[A-Z]{3}$/.test(p.airport) ? '' : 'Use the 3-letter airport code, such as BOM.'),
    () => '', () => '', () => '', () => '', () => '',
  ];
  const optional = [false, false, false, false, true, true, true, false, false];
  const skippable = optional[i] && !(i === 4 ? p.bankIds.length : i === 5 ? p.cardIds.length : Object.values(p.balances).some(Boolean));

  const withDob = (x: Profile): Profile => ({ ...x, dob: dobIso || x.dob });
  const next = () => {
    const e = checks[i]();
    if (e) return setErr(e);
    saveProfile(withDob(p));
    setI(x => Math.min(LAST, x + 1));
    scrollTo({ top: 0 });
  };
  // Skipping the account lands on the plan page, which works signed out. /home needs an account.
  const finish = () => {
    saveProfile(withDob(p));
    router.push(user ? nextPath() : '/plan');
  };

  // After the email code (or when already signed in): save the setup to the account, note Pro interest, then go plan.
  async function saveToAccount() {
    setBusy(true);
    setErr('');
    const done = withDob(p);
    saveProfile(done);
    const saved = await pushProfile(done, programmeOfCard);
    if (p.plan === 'pro') await recordInterest('pro', p.period);
    setBusy(false);
    if (!saved) return setErr('You are signed in, but we could not save the setup to your account. It is still on this device.');
    router.push(nextPath());
  }

  const field = (id: string, label: string, value: string, on: (v: string) => void, o: { ph?: string; ac?: string; mono?: boolean } = {}) => (
    <div className={'field' + (err ? ' bad' : '')}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} placeholder={o.ph} autoComplete={o.ac} maxLength={o.mono ? 3 : 60} className={o.mono ? 't-mono' : undefined}
        onChange={e => on(e.target.value)} onKeyDown={e => e.key === 'Enter' && next()} autoFocus={i <= 3} />
    </div>
  );
  const tile = (key: string, on: boolean, role: 'checkbox' | 'radio', click: () => void, body: React.ReactNode, disabled = false) => (
    <button key={key} type="button" className="tile" role={role} aria-checked={on} aria-disabled={disabled} onClick={() => !disabled && click()}>
      <span>{body}</span><span className="tick"><Check size={14} /></span>
    </button>
  );

  const title = [
    'What should we call you?', 'And your last name?', 'When were you born?', 'Where do you fly from?', 'Which banks do you bank with?', 'Which cards do you hold?',
    p.cardIds.length ? 'About how many points on each?' : 'Points come next', 'What do you want to fly?', 'Free, or help build Pro?',
    p.plan === 'pro' ? 'Add your email for the Pro list' : 'Save your setup with your email',
  ][i];
  const hint = [
    '', 'As it appears on your passport. Award tickets must match it.', 'Airlines ask for it when you book an award seat.', 'Type the 3-letter code, or pick one.',
    'Cards, savings accounts, anything. It decides which transfers apply to you.', p.bankIds.length ? 'These are the cards from the banks you picked.' : 'Pick the ones you hold. Each card feeds a points programme.',
    p.cardIds.length ? 'A rough number is fine. You can change it any time.' : 'You skipped cards, so there is nothing to fill in yet.', 'We plan business class first. Change it in any search.',
    'Every feature stays free either way. Pro only adds extras that are not built yet, and nothing is charged today.',
    'An account is optional. It keeps your cards on every device and, if you chose Pro, tells you when it opens.',
  ][i];

  const cardBank = p.bankIds.length ? p.bankIds : banks.map(b => b.id);

  return (
    <div className="start">
      <FlightScene step={i} from={p.airport} />
      <section className="panel" aria-live="polite">
        <div className="panel-in">
          {!user && <p className="member">Already a member? <a href={`/signin${search}`}>Sign in here</a></p>}
          <div className="progress" aria-hidden="true">{Array.from({ length: LAST + 1 }, (_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
          {i > 0 && <button type="button" className="back" onClick={() => { setErr(''); setI(x => x - 1); }}><Back /> Back</button>}
          <p className="say"><span className="av" aria-hidden="true"><Arrow size={14} /></span>{i === 1 && p.first.trim() ? `Good to meet you, ${p.first.trim()}.` : SAY[i]}</p>
          <h1 className="t-h1">{title}</h1>
          {hint && <p className="lede">{hint}</p>}

          <div className="q">
            {i === 0 && field('first', 'First name', p.first, v => set('first', v), { ph: 'Anaya', ac: 'given-name' })}
            {i === 1 && field('last', 'Last name', p.last, v => set('last', v), { ph: 'Kulkarni', ac: 'family-name' })}
            {i === 2 && (
              <div className="dob">
                <div className="field"><label htmlFor="dd">Day</label><input id="dd" inputMode="numeric" maxLength={2} placeholder="DD" autoComplete="bday-day" value={dd} onChange={e => { setDd(digits(e.target.value, 2)); setErr(''); }} autoFocus /></div>
                <div className="field"><label htmlFor="mm">Month</label><input id="mm" inputMode="numeric" maxLength={2} placeholder="MM" autoComplete="bday-month" value={mm} onChange={e => { setMm(digits(e.target.value, 2)); setErr(''); }} /></div>
                <div className="field"><label htmlFor="yy">Year</label><input id="yy" inputMode="numeric" maxLength={4} placeholder="YYYY" autoComplete="bday-year" value={yy} onChange={e => { setYy(digits(e.target.value, 4)); setErr(''); }} onKeyDown={e => e.key === 'Enter' && next()} /></div>
              </div>
            )}
            {i === 3 && (
              <>
                {field('ap', 'Home airport', p.airport, v => set('airport', v.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3)), { ph: 'BOM', mono: true })}
                <div className="chips" role="group" aria-label="Common airports">{AIRPORTS.map(a => <button key={a} type="button" className="pick" aria-pressed={p.airport === a} onClick={() => set('airport', a)}>{a}</button>)}</div>
              </>
            )}
            {i === 4 && <div className="tiles two" role="group" aria-label="Banks">{banks.map(b => tile(b.id, p.bankIds.includes(b.id), 'checkbox', () => {
              const bankIds = flip(p.bankIds, b.id);
              setP(x => ({ ...x, bankIds, cardIds: bankIds.length ? x.cardIds.filter(c => bankIds.includes(cards.find(y => y.id === c)!.bankId)) : x.cardIds }));
            }, b.name))}</div>}
            {i === 5 && (
              <div className="tiles" role="group" aria-label="Cards">
                {cardBank.map(b => (
                  <div key={b} className="tiles">
                    <p className="grp">{bankName(b)}</p>
                    {cards.filter(c => c.bankId === b).map(c => tile(c.id, p.cardIds.includes(c.id), 'checkbox', () => set('cardIds', flip(p.cardIds, c.id)), <>{c.name}<small>{programmes[c.programmeId]}</small></>))}
                  </div>
                ))}
              </div>
            )}
            {i === 6 && (
              p.cardIds.length ? (
                <div>
                  <div className="gmail-imp" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <a className="btn btn-secondary" href="/api/gmail/start?next=start" onClick={() => saveProfile(withDob(p))} aria-disabled={gm.busy}>Import from Gmail</a>
                    <small className="muted">Read-only, used once, never stored. We only look at mail from your banks.</small>
                  </div>
                  {gm.busy && <p className="t-sm" role="status">Reading your bank emails. This takes up to a minute.</p>}
                  {!gm.busy && gm.msg && <p className="t-sm" role="status">{gm.msg}</p>}
                  {p.cardIds.map(id => {
                    const c = cards.find(x => x.id === id)!;
                    const v = p.balances[id] ?? 0;
                    return (
                      <div className="bal" key={id}>
                        <label htmlFor={`b-${id}`} className="t-sm"><b>{bankName(c.bankId)} {c.name}</b> <span className="muted">· {programmes[c.programmeId]}</span></label>
                        <div className="row">
                          <input id={`b-${id}`} className="input" style={{ minHeight: 44, padding: '10px 14px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1.5px solid var(--color-border-strong)', borderRadius: 8, font: 'inherit' }} inputMode="numeric" placeholder="0" value={v ? n(v) : ''} onChange={e => set('balances', { ...p.balances, [id]: Number(digits(e.target.value, 9)) })} />
                          <button type="button" className="add" onClick={() => set('balances', { ...p.balances, [id]: v + 10000 })}>+10,000</button>
                          <button type="button" className="add" onClick={() => set('balances', { ...p.balances, [id]: v + 50000 })}>+50,000</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="note note-info">Add cards later on the plan page. Balances are typed, never linked.</div>
            )}
            {i === 7 && <div className="tiles" role="radiogroup" aria-label="Cabin">{CABINS.map(c => tile(c.id, p.cabin === c.id, 'radio', () => set('cabin', c.id), <>{c.name}{c.live && <span className="tag tag-sand" style={{ marginLeft: 8 }}>Premium cabin</span>}<small>{c.note}</small></>, !c.live))}</div>}
            {i === 8 && <PlanPicker tier={p.plan} period={p.period} onTier={t => set('plan', t)} onPeriod={x => set('period', x)} />}
            {i === 9 && (
              user ? (
                <div className="stack" style={{ ['--stack' as string]: '12px' }}>
                  <div className="note note-ok"><Check /><span>You are signed in as {user.email}. Your setup {p.plan === 'pro' ? 'and your Pro interest ' : ''}will be saved to your account.</span></div>
                </div>
              ) : (
                <EmailCode
                  meta={{ first_name: p.first.trim(), last_name: p.last.trim() }}
                  onVerified={saveToAccount}
                  intro={p.plan === 'pro' ? <div className="note note-info"><Lock /><span>Pro has not opened, so nothing is charged. Your verified email is how we tell you when it does.</span></div> : null}
                />
              )
            )}
            {err && <p className="err t-sm" role="alert" style={{ color: 'var(--color-danger)', marginTop: 10 }}>{err}</p>}
          </div>

          <div className="s-actions">
            {i < LAST && <button type="button" className="btn btn-primary" onClick={next}>{skippable ? 'Skip for now' : 'Continue'} <Arrow /></button>}
            {i === LAST && user && <button type="button" className="btn btn-primary" disabled={busy} onClick={saveToAccount}>{busy ? <><span className="spin" /> Saving</> : <>Save and plan a trip <Arrow /></>}</button>}
            {i === LAST && <button type="button" className="btn btn-secondary" onClick={finish}>{user ? 'Plan without saving' : 'Skip the account and plan a trip'}</button>}
          </div>
          <p className="fine">{i < LAST ? <>Your answers stay on this device. <button type="button" className="link" onClick={finish}>Skip setup</button> and add this later.</> : p.plan === 'pro' && !user ? 'Skipping means you will not be on the Pro list. Everything else still works.' : 'You can change any of this later from your account.'}</p>
        </div>
      </section>
    </div>
  );
}
