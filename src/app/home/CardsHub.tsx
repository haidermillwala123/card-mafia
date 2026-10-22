'use client';

// Cards and points hub on /home: pick a card, see transfer ratios, how it earns, fees and limits.
// Everything is read from the research files already in the app. Missing values say "not found", never 0 or "no limit".
import Link from 'next/link';
import { useState } from 'react';
import Select from '@/components/Select';
import { bankName, CARDS, programmeName } from '@/lib/app/catalog';
import { fmt } from '@/lib/app/format';
import earnJson from '@/data/earn_rules.json';
import limitsJson from '@/data/transfer_limits.json';
import rulesJson from '@/data/transfer_rules.json';

type Rule = { to: string; ratio_in: number; ratio_out: number; monthly_cap: number | null; annual_cap: number | null; transfer_time: string | null; route_confirmed_on: string | null; from: string };
type Earn = {
  annual_fee_inr: number | null; joining_fee_inr: number | null; reward_currency: string | null; confidence: string;
  base_earn: { rate_text: string | null } | null;
  accelerated: { category: string; rate_text: string }[];
  milestones: { benefit: string; spend_inr: number | null }[];
  best_way_to_earn?: string | null;
};
type Limit = { fees?: { annual: string | null; joining: string | null }; min_transfer: unknown; multiple_of: unknown; transfer_fee: unknown; confidence: string; limits?: Record<string, unknown> };

const RULES = (rulesJson as unknown as { rules: Rule[] }).rules;
const EARN = earnJson.cards as unknown as Record<string, Earn>;
const LIMITS = limitsJson.cards as unknown as Record<string, Limit>;
const TABS = ['Transfer ratios', 'How to earn', 'Fees and limits'] as const;
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n))}…`);
const NF =<span className="a-mu">not found</span>;
const show = (v: unknown) => (v === null || v === undefined || v === '' ? NF : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function CardsHub({ cardIds }: { cardIds: string[] }) {
  const list = cardIds.length ? CARDS.filter(c => cardIds.includes(c.id)) : CARDS;
  const [id, setId] = useState(list[0]?.id ?? '');
  const [tab, setTab] = useState<(typeof TABS)[number]>('Transfer ratios');
  const card = CARDS.find(c => c.id === id) ?? list[0];
  if (!card) return null;
  const rules = RULES.filter(r => r.from === card.programme).sort((a, b) => a.ratio_in / a.ratio_out - b.ratio_in / b.ratio_out);
  const earn = EARN[card.id];
  const lim = LIMITS[card.id];

  return (
    <section className="a-gl a-hub" aria-label="Cards and points">
      <div className="a-r a-rw">
        <h2 className="a-sec a-g">Cards and points</h2>
        <span className="a-cap">{cardIds.length ? 'Your cards' : 'All 58 cards. Add yours in Wallet to see only them.'}</span>
      </div>
      {cardIds.length > 0 ? (
        <div className="a-chips" role="group" aria-label="Pick a card">
          {list.map(c => <button key={c.id} type="button" className="a-chip" aria-pressed={c.id === card.id} onClick={() => setId(c.id)}>{bankName(c.bank)} {c.name}</button>)}
        </div>
      ) : (
        <label className="cm-field">
          <span className="cm-field__label">Card</span>
          <span className="cm-control">
            <Select value={card.id} onChange={e => setId(e.target.value)}>{CARDS.map(c => <option key={c.id} value={c.id}>{bankName(c.bank)} {c.name}</option>)}</Select>
          </span>
        </label>
      )}
      <div className="a-chips" role="group" aria-label="What to see">
        {TABS.map(t => <button key={t} type="button" className="a-chip" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Transfer ratios' && (
        <div className="a-c">
          {rules.length === 0 ? <span className="a-mu">We found no transfer partners for this card.</span> : (
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead><tr><th>Partner</th><th className="is-num">Ratio</th><th>Cap</th><th>Time</th><th>Route seen working</th></tr></thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.to}>
                      <td>{programmeName(r.to)}</td>
                      <td className="is-num is-mono">{r.ratio_in}:{r.ratio_out}</td>
                      <td>{r.monthly_cap ? `${fmt(r.monthly_cap)} a month` : r.annual_cap ? `${fmt(r.annual_cap)} a year` : NF}</td>
                      <td>{show(r.transfer_time)}</td>
                      <td>{r.route_confirmed_on ?? <span className="a-mu">not yet confirmed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link className="cm-btn cm-btn--ghost cm-btn--sm" style={{ alignSelf: 'flex-start' }} href={`/transfers/${card.id}`}>All routes, including indirect ones</Link>
        </div>
      )}

      {tab === 'How to earn' && (
        <div className="a-c">
          {!earn ? <span className="a-mu">No earn data found for this card.</span> : (
            <>
              <div className="a-kv"><span>Base rate</span><b>{show(earn.base_earn?.rate_text)}</b></div>
              <div className="a-kv"><span>Reward currency</span><b>{show(earn.reward_currency)}</b></div>
              {earn.best_way_to_earn && <div className="a-kv"><span>Best way to earn</span><b>{clip(earn.best_way_to_earn, 120)}</b></div>}
              {earn.accelerated.slice(0, 6).map((a, i) => <div className="a-kv" key={i}><span>{a.category}</span><b>{clip(a.rate_text, 70)}</b></div>)}
              {earn.accelerated.length > 6 && <span className="a-cap">{earn.accelerated.length - 6} more accelerated rows on the Earn page.</span>}
              {earn.milestones.map((m, i) => <div className="a-kv" key={i}><span>Milestone{m.spend_inr ? ` at ₹${fmt(m.spend_inr)}` : ''}</span><b>{m.benefit}</b></div>)}
              <Link className="cm-btn cm-btn--ghost cm-btn--sm" style={{ alignSelf: 'flex-start' }} href={`/earn#${card.id}`}>Full earn rules for this card</Link>
            </>
          )}
        </div>
      )}

      {tab === 'Fees and limits' && (
        <div className="a-c">
          <div className="a-kv"><span>Annual fee</span><b>{earn?.annual_fee_inr != null ? `₹${fmt(earn.annual_fee_inr)}` : show(lim?.fees?.annual)}</b></div>
          <div className="a-kv"><span>Joining fee</span><b>{earn?.joining_fee_inr != null ? `₹${fmt(earn.joining_fee_inr)}` : show(lim?.fees?.joining)}</b></div>
          {lim ? (
            <>
              {Object.entries(lim.limits ?? {}).map(([k, v]) => <div className="a-kv" key={k}><span>Transfer limit, {k}</span><b>{show(v)}</b></div>)}
              <div className="a-kv"><span>Minimum transfer</span><b>{show(lim.min_transfer)}</b></div>
              <div className="a-kv"><span>Transfer in multiples of</span><b>{show(lim.multiple_of)}</b></div>
              <div className="a-kv"><span>Transfer fee</span><b>{show(lim.transfer_fee)}</b></div>
            </>
          ) : <span className="a-mu">No transfer limits found for this card.</span>}
          <span className="a-cap">Not found means we could not find it. It does not mean there is no limit.</span>
        </div>
      )}
    </section>
  );
}
