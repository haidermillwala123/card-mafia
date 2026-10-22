import type { Metadata } from 'next';
import Link from 'next/link';
import Ic from '@/components/app/Icons';
import './learn.css';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Points in plain English: ratios, transfer blocks, caps, multi-hop paths and value per point, plus the transfer, calculator and rules tools.',
  alternates: { canonical: '/learn' },
};

const TOOLS = [
  { href: '/transfers', cap: 'Transfer explorer', title: 'Which card reaches which programme', body: 'Pick a card and see every partner, its ratio and when we last checked.', icon: 'badge' as const, note: 'Dated from bank pages' },
  { href: '/earn', cap: 'Earn', title: 'How to earn points on every card', body: 'Base rates, accelerated categories, caps and exclusions for 58 cards, plus a monthly spend ranking.', icon: 'badge' as const, note: 'Sourced and dated' },
  { href: '/calculator', cap: 'Calculator', title: 'What is a point worth?', body: 'Type a cash fare, taxes and points. We show the value per point.', icon: 'shield' as const, note: 'Maths done in code' },
  { href: '/rules', cap: 'Rules', title: 'Ratios, caps and transfer times', body: 'Every rule links to the bank page it came from, with the date we checked it.', icon: 'badge' as const, note: 'Checked on bank portals' },
];

const TERMS: [string, string][] = [
  ['Ratio', 'How many airline points you get for each bank point. 1:1 means equal. 2:1 means two bank points for one airline point.'],
  ['Transfer block', 'The smallest amount a bank lets you move at once.'],
  ['Monthly cap', 'The most points a bank lets you transfer in one month.'],
  ['Multi-hop', 'Moving points through more than one programme to reach the one you need. It can cut the points a seat costs.'],
  ['Value per point', '(Cash fare minus taxes) divided by points. It shows what each point bought you.'],
  ['Taxes and fees', 'Cash you still pay on an award ticket.'],
  ['Qsuite', 'Qatar Airways business class seat with a door.'],
  ['Data age', 'How long ago we saw a seat. Seats change fast, so older rows carry a warning.'],
];

export default function LearnPage() {
  return (
    <div className="a-pg">
      <div className="a-body">
        <span className="a-eb">Learn</span>
        <h1 className="a-hd a-sm">
          Points, in plain English.
          <br />
          <em>No jargon left unexplained.</em>
        </h1>
        <p className="a-lead">
          New to transfers? Start with the{' '}
          <span className="cm-tip">
            <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm a-learn-tip">
              ratio
              <span className="cm-tip__bubble" role="tooltip">
                Airline points you get for each bank point
              </span>
            </button>
          </span>
          , then try the tools.
        </p>

        <div className="a-g3">
          {TOOLS.map(t => (
            <Link key={t.href} className="a-gl a-learn-card" href={t.href}>
              <span className="a-cap">{t.cap}</span>
              <b className="a-t">{t.title}</b>
              <span className="a-mu">{t.body}</span>
              <span className="cm-stamp">
                <Ic name={t.icon} small />
                {t.note}
              </span>
            </Link>
          ))}
        </div>

        <div className="a-split">
          <div className="a-main a-gl">
            <h2 className="a-sec">Glossary</h2>
            <dl className="a-gloss">
              {TERMS.map(([term, text]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="a-side a-c" style={{ gap: 16 }}>
            <div className="a-gl">
              <span className="a-cap">Two things to know</span>
              <div className="a-step">
                <span className="a-n">1</span>
                <span>Transfers cannot be undone.</span>
              </div>
              <div className="a-step">
                <span className="a-n">2</span>
                <span>Seats can disappear before you transfer.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="a-foot">
          <span className="a-cap">Learning pages work without an account.</span>
          <span className="a-g" />
          <span className="a-cap">Card Mafia is not affiliated with banks or airlines.</span>
        </div>
      </div>
    </div>
  );
}
