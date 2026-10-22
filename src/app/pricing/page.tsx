import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import JsonLd from '@/components/JsonLd';
import { Check } from '@/components/Icons';
import { PRICES } from '@/lib/prices';

export const metadata: Metadata = {
  title: 'Free and Pro: what each includes',
  description: 'Card Mafia is free with every feature unlocked. Pro will add alerts, saved plans on every device and a pre-transfer seat re-check. Planned prices, no payment taken yet.',
  alternates: { canonical: '/pricing' },
};

const FAQ = [
  { q: 'Is anything in Card Mafia behind a paywall?', a: 'No. Trip plans, the safety check, the points calculator, the transfer explorer and every rule with its source are free and stay free.' },
  { q: 'What will Pro add?', a: 'Alerts when a rule on your path changes, saved plans and trip history on every device, and a seat re-check before you transfer once live availability connects. These are extras, not features taken out of Free.' },
  { q: 'Can I pay for Pro today?', a: 'Not yet. Pro has not opened, so no payment is taken. You can join the list during setup or from your account, and we email you when it opens.' },
];

export default function Pricing() {
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Free and Pro', href: '/pricing' }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      <div className="container stack" style={{ ['--stack' as string]: '28px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Free has everything. Pro adds extras.</h1>
        <p className="t-lg muted measure">Nothing in Card Mafia is locked. Pro is planned as a way to help pay for keeping the rules current, with a few extras on top.</p>
        <div className="tiers">
          <div className="tier" aria-label="Free plan">
            <div className="top"><b className="t-title">Free</b><span className="tag tag-ok">Everything</span></div>
            <p className="t-num" style={{ marginTop: 8 }}>{inr(0)}</p>
            <ul className="stack t-sm" style={{ ['--stack' as string]: '8px', marginTop: 12 }}>
              <li><Check size={14} /> Trip plans with the pre-transfer safety check</li>
              <li><Check size={14} /> The points calculator, all four modes</li>
              <li><Check size={14} /> The transfer explorer and every rule with its source</li>
              <li><Check size={14} /> Your setup saved on this device or to your account</li>
            </ul>
          </div>
          <div className="tier" aria-label="Pro plan">
            <div className="top"><b className="t-title">Pro</b><span className="tag tag-sand">Opens soon</span></div>
            <p className="t-num" style={{ marginTop: 8 }}>{inr(PRICES.yearly)}<span className="t-sm muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}> / year, or {inr(PRICES.monthly)} / month</span></p>
            <p className="t-sm muted">Planned prices, not final</p>
            <p className="t-sm" style={{ marginTop: 12 }}><b>Everything in Free, plus:</b></p>
            <ul className="stack t-sm" style={{ ['--stack' as string]: '8px', marginTop: 8 }}>
              <li><Check size={14} /> Alerts when a rule on your path changes</li>
              <li><Check size={14} /> Saved plans and trip history on every device</li>
              <li><Check size={14} /> A seat re-check before you transfer, once live availability connects</li>
            </ul>
          </div>
        </div>
        <div className="btn-row"><Link className="btn btn-primary" href="/start">Set up and choose a plan</Link><Link className="btn btn-secondary" href="/plan">Build a plan free</Link></div>
        <section className="faq" aria-labelledby="faq-h">
          <h2 id="faq-h" className="t-h2" style={{ marginBottom: 'var(--space-md)' }}>Questions</h2>
          {FAQ.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>
      </div>
    </>
  );
}
