'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Arrow, Lock } from './Icons';
import { supabase } from '@/lib/supabase';
import { markLive } from './SessionGate';

type Props = {
  meta?: { first_name?: string; last_name?: string };
  onVerified: (email: string) => void | Promise<void>;
  intro?: ReactNode;
  sendLabel?: string;
};

// Email sign-in with a six-character code. Nothing to remember, and no password to leak. The same form signs in a returning person or creates the account.
export default function EmailCode({ meta, onVerified, intro, sendLabel = 'Send the code' }: Props) {
  const sb = supabase();
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'' | 'err' | 'ok'>('');
  const [wait, setWait] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!sb) return <div className="note note-info">Email sign-in is not switched on for this copy. Everything else works without it.</div>;

  async function send() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) || clean.length > 254) return setErr('We could not read that address. Check for a typo.');
    setBusy(true);
    setErr('');
    const res = await fetch('/api/auth/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: clean }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      return setErr(j?.error ?? 'We could not send the code. Check the address and try again.');
    }
    setEmail(clean);
    setStage('otp');
    setWait(30);
  }

  async function verify(code: string) {
    setBusy(true);
    setErr('');
    const res = await fetch('/api/auth/code/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code, meta: { first_name: meta?.first_name?.slice(0, 60), last_name: meta?.last_name?.slice(0, 60) } }) }).catch(() => null);
    const j = res?.ok ? await res.json().catch(() => null) : null;
    if (j?.token_hash) markLive(); // before verifyOtp, so the session gate does not read the new login as a stale one
    const { error } = j?.token_hash ? await sb!.auth.verifyOtp({ token_hash: j.token_hash, type: j.type === 'signup' ? 'signup' : 'magiclink' }) : { error: true };
    if (error) {
      setBusy(false);
      setState('err');
      setErr('That code is not right or has expired. Try again.');
      setTimeout(() => { setState(''); boxes.current.forEach(b => { if (b) b.value = ''; }); boxes.current[0]?.focus(); }, 700);
      return;
    }
    setState('ok');
    try {
      await onVerified(email);
    } finally {
      setBusy(false);
    }
  }

  const type = (i: number, el: HTMLInputElement) => {
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    if (el.value && boxes.current[i + 1]) boxes.current[i + 1]!.focus();
    setErr('');
  };
  // The code is only checked when the person presses Submit (or Enter), never on its own.
  const submit = () => {
    const code = boxes.current.map(b => b?.value ?? '').join('');
    if (code.length !== 6) return setErr('Enter all six characters from the email.');
    void verify(code);
  };

  if (stage === 'email') {
    return (
      <div className="stack" style={{ ['--stack' as string]: '14px' }}>
        {intro}
        <div className={'field' + (err ? ' bad' : '')}>
          <label htmlFor="ec-email">Email</label>
          <input id="ec-email" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email}
            onChange={e => { setEmail(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && send()} />
          <span className="help">We email a six-character code. There is no password.</span>
          {err && <span className="err" role="alert">{err}</span>}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? <><span className="spin" /> Sending</> : <>{sendLabel} <Arrow /></>}</button>
        </div>
        <p className="t-sm muted"><Lock size={14} /> Card Mafia never asks for bank logins or bank OTPs. This code only protects your Card Mafia account.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ ['--stack' as string]: '14px' }}>
      <p className="muted">Sent to <b style={{ color: 'var(--color-text)' }}>{email}</b>. It expires in 10 minutes.</p>
      <div className={'otp ' + state} role="group" aria-label="Six-character code">
        {Array.from({ length: 6 }, (_, k) => (
          <input key={k} ref={el => { boxes.current[k] = el; }} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={1} aria-label={`Digit ${k + 1}`} autoComplete={k ? 'off' : 'one-time-code'} autoFocus={k === 0} disabled={busy}
            onChange={e => type(k, e.target)} placeholder="·" onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Backspace' && !e.currentTarget.value && k) boxes.current[k - 1]?.focus(); }}
            onPaste={e => {
              const d = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
              if (!d) return;
              e.preventDefault();
              [...d].forEach((ch, j) => { if (boxes.current[j]) boxes.current[j]!.value = ch; });
              boxes.current[Math.min(d.length, 5)]?.focus();
            }} />
        ))}
      </div>
      {err && <p className="err t-sm" role="alert" style={{ color: 'var(--color-danger)' }}>{err}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? <><span className="spin" /> Checking</> : <>Submit code <Arrow /></>}</button>
        <button type="button" className="btn btn-ghost" disabled={wait > 0 || busy} onClick={() => { setStage('email'); setErr(''); }}>{wait > 0 ? `Change email (${wait}s)` : 'Change email'}</button>
      </div>
    </div>
  );
}
