'use client';

import { Check } from './Icons';
import type { Period, Tier } from '@/lib/auth';
import { PRICES } from '@/lib/prices';

const FREE = [
  'Trip plans with the pre-transfer safety check',
  'The points calculator, all four modes',
  'The transfer explorer for every card, and every rule with its source',
  'Your setup, saved on this device or to your account',
];
const PRO = [
  'Alerts when a rule on your path changes',
  'Saved plans and trip history on every device',
  'A seat re-check before you transfer, once live availability connects',
];

type Props = { tier: Tier; period: Period; onTier: (t: Tier) => void; onPeriod: (p: Period) => void; readOnly?: boolean };

export default function PlanPicker({ tier, period, onTier, onPeriod, readOnly }: Props) {
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const card = (id: Tier, on: boolean) => ({ role: 'radio' as const, 'aria-checked': on, onClick: () => !readOnly && onTier(id), tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (!readOnly && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onTier(id); } } });
  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      <div className="note note-ok"><Check /><span><b>Nothing is locked.</b> Free keeps every feature. Pro adds the extras below and helps pay to keep the rules current. No payment is taken today.</span></div>
      <div className="tiers" role="radiogroup" aria-label="Plan">
        <div className="tier" {...card('free', tier === 'free')}>
          <div className="top"><b className="t-title">Free</b><span className="tag tag-ok">Everything</span></div>
          <p className="t-num" style={{ marginTop: 8 }}>{inr(0)}</p>
          <p className="t-sm muted">always</p>
          <ul className="stack" style={{ ['--stack' as string]: '8px', marginTop: 12 }}>{FREE.map(f => <li key={f} className="t-sm"><Check size={14} /> {f}</li>)}</ul>
        </div>
        <div className="tier" {...card('pro', tier === 'pro')}>
          <div className="top"><b className="t-title">Pro</b><span className="tag tag-sand">Opens soon</span></div>
          <p className="t-num" style={{ marginTop: 8 }}>{inr(PRICES[period])}<span className="t-sm muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}> / {period === 'yearly' ? 'year' : 'month'}</span></p>
          <p className="t-sm muted">Planned price, not final</p>
          <p className="t-sm" style={{ marginTop: 12 }}><b>Everything in Free, plus:</b></p>
          <ul className="stack" style={{ ['--stack' as string]: '8px', marginTop: 8 }}>{PRO.map(f => <li key={f} className="t-sm"><Check size={14} /> {f}</li>)}</ul>
        </div>
      </div>
      {tier === 'pro' && (
        <div className="btn-row" role="group" aria-label="Billing period">
          {(['yearly', 'monthly'] as Period[]).map(p => (
            <button key={p} type="button" className={period === p ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} aria-pressed={period === p} disabled={readOnly} onClick={() => onPeriod(p)}>{p === 'yearly' ? 'Yearly, 2 months free' : 'Monthly'}</button>
          ))}
        </div>
      )}
    </div>
  );
}
