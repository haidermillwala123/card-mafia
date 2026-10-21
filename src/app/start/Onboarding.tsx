'use client';

import './start.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FlightScene from './FlightScene';
import { Arrow, Back, Check, Lock } from '@/components/Icons';
import { loadProfile, saveProfile, type Profile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

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
const SAY = ['Check-in is open.', 'Good to meet you.', 'Wheels up.', 'Climbing. Passenger details are nearly done.', 'Cruising altitude. The easy part.', 'Starting our descent.', 'On final. Almost there.', 'Wheels down.', 'At the gate. One last choice.'];
const n = (x: number) => x.toLocaleString('en-IN');
const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);
const EMPTY: Profile = { first: '', last: '', dob: '', airport: '', cabin: 'business', bankIds: [], cardIds: [], balances: {} };

export default function Onboarding({ banks, cards, programmes }: Props) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [p, setP] = useState<Profile>(EMPTY);
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yy, setYy] = useState('');
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'choose' | 'email' | 'otp'>('choose');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpState, setOtpState] = useState<'' | 'err' | 'ok'>('');
  const otp = useRef<(HTMLInputElement | null)[]>([]);
  const started = useRef(false);
  const LAST = 8;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Device storage can only be read after mount: reading it during render would not match the server HTML.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadProfile();
    if (saved) {
      setP({ ...EMPTY, ...saved });
      const [y, m, d] = (saved.dob || '').split('-');
      setYy(y ?? ''); setMm(m ?? ''); setDd(d ?? '');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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

  const next = () => {
    const e = checks[i]();
    if (e) return setErr(e);
    if (i === 2) set('dob', dobIso);
    saveProfile({ ...p, dob: i >= 2 ? dobIso || p.dob : p.dob });
    setI(x => Math.min(LAST, x + 1));
    scrollTo({ top: 0 });
  };

  const finish = () => {
    saveProfile({ ...p, dob: dobIso || p.dob });
    router.push('/plan');
  };

  // ----- optional account save: email code, then the whole setup in one call -----
  const sb = supabase();
  async function sendCode() {
    if (!sb) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('We could not read that address. Check for a typo.');
    setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: { first_name: p.first.trim(), last_name: p.last.trim() } } });
    setBusy(false);
    if (error) return setErr(/rate/i.test(error.message) ? 'Too many codes sent. Try again in a few minutes.' : 'We could not send the code. Check the address and try again.');
    setMode('otp');
  }
  async function verify(code: string) {
    if (!sb) return;
    setBusy(true); setErr('');
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    if (error) {
      setBusy(false); setOtpState('err'); setErr('That code is not right. Try again.');
      setTimeout(() => { setOtpState(''); otp.current.forEach(el => { if (el) el.value = ''; }); otp.current[0]?.focus(); }, 700);
      return;
    }
    const byProgramme: Record<string, number> = {};
    for (const id of p.cardIds) {
      const prog = cards.find(c => c.id === id)?.programmeId;
      if (prog && p.balances[id]) byProgramme[prog] = (byProgramme[prog] ?? 0) + p.balances[id];
    }
    const { error: saveErr } = await sb.rpc('save_onboarding', {
      p_first: p.first.trim(), p_last: p.last.trim(), p_dob: dobIso || null, p_airport: p.airport, p_cabin: p.cabin,
      p_bank_ids: p.bankIds, p_card_ids: p.cardIds, p_balances: byProgramme,
    });
    setBusy(false);
    if (saveErr) return setErr('You are signed in, but we could not save the setup. It is still on this device.');
    setOtpState('ok');
    setTimeout(finish, 600);
  }
  const onOtp = (idx: number, el: HTMLInputElement) => {
    el.value = el.value.replace(/\D/g, '').slice(-1);
    if (el.value && otp.current[idx + 1]) otp.current[idx + 1]!.focus();
    const code = otp.current.map(x => x?.value ?? '').join('');
    if (code.length === 6) void verify(code);
  };

  const field = (id: string, label: string, value: string, on: (v: string) => void, o: { ph?: string; ac?: string; mode?: 'numeric' | 'email'; max?: number; mono?: boolean } = {}) => (
    <div className={'field' + (err ? ' bad' : '')}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} placeholder={o.ph} autoComplete={o.ac} inputMode={o.mode} maxLength={o.max} className={o.mono ? 't-mono' : undefined}
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
    p.cardIds.length ? 'About how many points on each?' : 'Points come next', 'What do you want to fly?', 'Save this setup?',
  ][i];
  const hint = [
    '', 'As it appears on your passport. Award tickets must match it.', 'Airlines ask for it when you book an award seat.', 'Type the 3-letter code, or pick one.',
    'Cards, savings accounts, anything. It decides which transfers apply to you.', p.bankIds.length ? 'These are the cards from the banks you picked.' : 'Pick the ones you hold. Each card feeds a points programme.',
    p.cardIds.length ? 'A rough number is fine. You can change it any time.' : 'You skipped cards, so there is nothing to fill in yet.', 'We plan business class first. Change it in any search.',
    'Your answers are on this device now. Save them to an account only if you want them on other devices.',
  ][i];

  const cardBank = p.bankIds.length ? p.bankIds : banks.map(b => b.id);

  return (
    <div className="start">
      <FlightScene step={i} from={p.airport} />
      <section className="panel" aria-live="polite">
        <div className="panel-in">
          <div className="progress" aria-hidden="true">{Array.from({ length: 9 }, (_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
          {i > 0 && mode === 'choose' && <button type="button" className="back" onClick={() => { setErr(''); setI(x => x - 1); }}><Back /> Back</button>}
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
                {field('ap', 'Home airport', p.airport, v => set('airport', v.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3)), { ph: 'BOM', max: 3, mono: true })}
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
            {i === 8 && mode === 'choose' && (
              <div className="stack" style={{ ['--stack' as string]: '12px' }}>
                <div className="note note-info"><Lock /><span>Card Mafia never asks for logins or OTPs from your bank. This email code only protects your saved setup.</span></div>
                {!sb && <p className="t-sm muted">Saving to an account is not switched on for this copy. Your setup stays on this device.</p>}
              </div>
            )}
            {i === 8 && mode === 'email' && (
              <div className="field"><label htmlFor="em">Email</label><input id="em" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && sendCode()} autoFocus /><span className="help">We send a six-digit code to confirm it.</span></div>
            )}
            {i === 8 && mode === 'otp' && (
              <div>
                <p className="muted">Sent to <b style={{ color: 'var(--color-text)' }}>{email.trim()}</b>. It expires in 10 minutes.</p>
                <div className={'otp ' + otpState} role="group" aria-label="Six-digit code">
                  {Array.from({ length: 6 }, (_, k) => <input key={k} ref={el => { otp.current[k] = el; }} inputMode="numeric" maxLength={1} aria-label={`Digit ${k + 1}`} autoComplete={k ? 'off' : 'one-time-code'} autoFocus={k === 0}
                    onChange={e => onOtp(k, e.target)} onKeyDown={e => { if (e.key === 'Backspace' && !e.currentTarget.value && k) otp.current[k - 1]?.focus(); }}
                    onPaste={e => { const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (!d) return; e.preventDefault(); [...d].forEach((ch, j) => { if (otp.current[j]) otp.current[j]!.value = ch; }); otp.current[Math.min(d.length, 5)]?.focus(); if (d.length === 6) void verify(d); }} />)}
                </div>
              </div>
            )}
            {err && <p className="err t-sm" role="alert" style={{ color: 'var(--color-danger)', marginTop: 10 }}>{err}</p>}
          </div>

          <div className="s-actions">
            {i < 8 && <button type="button" className="btn btn-primary" onClick={next}>{skippable ? 'Skip for now' : 'Continue'} <Arrow /></button>}
            {i === 8 && mode === 'choose' && <>
              <button type="button" className="btn btn-primary" onClick={finish}>Plan a trip <Arrow /></button>
              {sb && <button type="button" className="btn btn-secondary" onClick={() => setMode('email')}>Also save to an account</button>}
            </>}
            {i === 8 && mode === 'email' && <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={sendCode}>{busy ? <><span className="spin" /> Sending</> : 'Send the code'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setMode('choose'); setErr(''); }}>Not now</button>
            </>}
            {i === 8 && mode === 'otp' && <button type="button" className="btn btn-ghost" onClick={() => { setMode('email'); setErr(''); }}>Use a different email</button>}
          </div>
          <p className="fine">{i < 8 ? <>Your answers stay on this device. <button type="button" className="link" onClick={finish}>Skip setup</button> and add this later.</> : 'You can change any of this later.'}</p>
        </div>
      </section>
    </div>
  );
}
