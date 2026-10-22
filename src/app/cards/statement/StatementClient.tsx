'use client';

// Statement to spend to card: read a statement (PDF or pasted lines), let the person fix any category, then show which card earns the most
// on each kind of spend, counting the cards they already hold. The statement is read in memory and never stored.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import type { CalcEntry, MilesRate } from '@/app/earn/EarnCalculator';
import Select from '@/components/Select';
import { Note } from '@/components/app/ui';
import { fmt } from '@/lib/app/format';
import { useWallet } from '@/lib/app/wallet';
import { CAT_LABEL, CATS, type Cat } from '@/lib/earn';
import { feeTier } from '@/lib/fees';
import { recommend } from '@/lib/recommend';
import { monthlySpend, monthsCovered, parseStatementText, type Txn } from '@/lib/statement';

type Props = {
  cards: CalcEntry[];
  fees: Record<string, number | null>;
  programmes: { id: string; name: string }[];
  miles: Record<string, Record<string, MilesRate>>;
};
type Row = Txn & { on: boolean };

export default function StatementClient({ cards, fees, programmes, miles }: Props) {
  const router = useRouter();
  const w = useWallet();
  const [mode, setMode] = useState<'pdf' | 'paste'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<{ from: string | null; to: string | null; skipped: number }>({ from: null, to: null, skipped: 0 });
  const [open, setOpen] = useState(false);
  const [prog, setProg] = useState('');
  const drop = useRef<HTMLLabelElement>(null);

  const [sorting, setSorting] = useState(false);

  // The keyword rules leave unknown merchants as "general". The model places them; only merchant text leaves the browser, never amounts or dates.
  async function refine(txns: Txn[]) {
    const descs = [...new Set(txns.filter(t => t.cat === 'general').map(t => t.desc.slice(0, 60)))].slice(0, 200);
    if (!descs.length) return;
    setSorting(true);
    const found = new Map<string, Cat>();
    for (let i = 0; i < descs.length; i += 100) {
      const chunk = descs.slice(i, i + 100);
      const res = await fetch('/api/statement/categorize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ descs: chunk }) }).catch(() => null);
      const j = (await res?.json().catch(() => null)) as { cats?: (Cat | null)[] } | null;
      j?.cats?.forEach((c, k) => { if (c && c !== 'general') found.set(chunk[k], c); });
    }
    setRows(rs => rs && rs.map(r => (r.cat === 'general' && found.has(r.desc.slice(0, 60)) ? { ...r, cat: found.get(r.desc.slice(0, 60))! } : r)));
    setSorting(false);
  }

  const load = (txns: Txn[], from: string | null, to: string | null, skipped: number) => {
    setRows(txns.map(t => ({ ...t, on: true })));
    setMeta({ from, to, skipped });
    setError('');
    setOpen(true);
    void refine(txns);
  };

  async function readPdf() {
    if (!file) return setError('Choose your statement PDF first.');
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    if (password) fd.append('password', password);
    const res = await fetch('/api/statement/pdf', { method: 'POST', body: fd }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { txns?: Txn[]; from?: string | null; to?: string | null; skipped?: number; error?: string; needsPassword?: boolean } | null;
    setBusy(false);
    if (!res?.ok || !j?.txns) {
      setNeedsPassword(!!j?.needsPassword);
      return setError(j?.error ?? 'We could not reach the server. Try again.');
    }
    setNeedsPassword(false);
    load(j.txns, j.from ?? null, j.to ?? null, j.skipped ?? 0);
  }

  function readPasted() {
    const p = parseStatementText(pasted);
    if (!p.txns.length) return setError('We found no transactions. Each line needs a date, a merchant and an amount, like 12/10/2026 SWIGGY 1,245.00.');
    load(p.txns, p.from, p.to, p.skipped);
  }

  const used = useMemo(() => (rows ?? []).filter(r => r.on), [rows]);
  const months = monthsCovered(meta.from, meta.to);
  const spend = useMemo(() => monthlySpend(used, months), [used, months]);
  const total = Object.values(spend).reduce<number>((s, v) => s + (v ?? 0), 0);
  const held = w.profile.cardIds;

  // for each kind of spend: the best card overall, and the best one already held
  const perCat = useMemo(() => {
    const targets = prog ? [prog] : [];
    return CATS.filter(c => (spend[c] ?? 0) > 0).map(cat => {
      const r = recommend({ cards, miles, spend: { [cat]: spend[cat] }, targets, held: [], fees, feeCap: Infinity });
      const best = r.picks[0];
      const mine = r.picks.find(p => held.includes(p.card.card_id));
      return { cat, amount: spend[cat]!, best, mine, picks: r.picks };
    });
  }, [cards, miles, spend, prog, fees, held]);

  // One card against a small basket (at most three), built greedily: add the card that lifts total monthly miles most, stop when the next one barely helps.
  const suggestion = useMemo(() => {
    if (!perCat.length) return null;
    const milesOf = (id: string, pc: (typeof perCat)[number]) => pc.picks.find(p => p.card.card_id === id)?.miles ?? 0;
    const ids = [...new Set(perCat.flatMap(pc => pc.picks.slice(0, 8).map(p => p.card.card_id)))];
    const score = (set: string[]) => perCat.reduce((s, pc) => s + Math.max(0, ...set.map(id => milesOf(id, pc))), 0);
    const set: string[] = [];
    let cur = 0;
    while (set.length < 3) {
      let pick = '', top = cur;
      for (const id of ids) if (!set.includes(id)) { const v = score([...set, id]); if (v > top) { top = v; pick = id; } }
      if (!pick || (set.length > 0 && top - cur < Math.max(300, cur * 0.08))) break;
      set.push(pick);
      cur = top;
    }
    if (!set.length) return null;
    const byId = (id: string) => cards.find(c => c.card_id === id)!;
    const single = score([set[0]]);
    const covers = (id: string) => perCat.filter(pc => set.every(o => milesOf(o, pc) <= milesOf(id, pc))).map(pc => CAT_LABEL[pc.cat]);
    return {
      one: byId(set[0]), oneMiles: single, oneFee: fees[set[0]] ?? 0,
      basket: set.map(id => ({ card: byId(id), covers: covers(id) })), basketMiles: cur, basketFee: set.reduce((s, id) => s + (fees[id] ?? 0), 0),
      basketWins: set.length > 1 && cur >= single * 1.2,
    };
  }, [perCat, cards, fees]);
  const uplift = perCat.reduce((s, p) => s + Math.max(0, (p.best?.miles ?? 0) - (p.mine?.miles ?? 0)), 0);

  function useInRecommender() {
    try { sessionStorage.setItem('cm-spend', JSON.stringify(spend)); } catch { /* the recommender just starts empty */ }
    router.push('/cards/recommend');
  }

  return (
    <div className="st">
      {!rows && (
        <section className="st-in" aria-label="Add a statement">
          <div className="seg" role="group" aria-label="How to add it">
            <button type="button" aria-pressed={mode === 'pdf'} onClick={() => { setMode('pdf'); setError(''); }}>Upload PDF</button>
            <button type="button" aria-pressed={mode === 'paste'} onClick={() => { setMode('paste'); setError(''); }}>Paste transactions</button>
          </div>

          {mode === 'pdf' ? (
            <>
              <label ref={drop} className={`st-drop${file ? ' has' : ''}`} onDragOver={e => { e.preventDefault(); drop.current?.classList.add('over'); }} onDragLeave={() => drop.current?.classList.remove('over')}
                onDrop={e => { e.preventDefault(); drop.current?.classList.remove('over'); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}>
                <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <b>{file ? file.name : 'Drop your statement PDF here, or choose a file'}</b>
                <small>{file ? `${(file.size / 1024).toFixed(0)} KB` : 'Up to 4 MB. Read once, never stored.'}</small>
              </label>
              {needsPassword && (
                <label className="st-pw">
                  <span>PDF password</span>
                  <input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder="Often your date of birth or the last digits of your card" />
                </label>
              )}
              <button type="button" className="a-cta" disabled={busy || !file} onClick={readPdf}>{busy ? 'Reading' : 'Read my statement'}</button>
            </>
          ) : (
            <>
              <label className="st-pw">
                <span>Paste your transactions</span>
                <textarea rows={9} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={'12/10/2026  SWIGGY BANGALORE  1,245.00\n14/10/2026  AMAZON PAY INDIA  2,300.50\n15/10/2026  INDIAN OIL FUEL  3,000.00'} />
              </label>
              <button type="button" className="a-cta" disabled={!pasted.trim()} onClick={readPasted}>Read these transactions</button>
            </>
          )}
          {error && <Note kind="danger" title="Could not read it.">{error}</Note>}
          <p className="st-fine">We never ask for your card number. Copy from your bank&apos;s statement or net banking, or upload the PDF it emails you.</p>
        </section>
      )}

      {rows && (
        <>
          <section className="st-sum" aria-label="Your spending">
            <div className="st-head">
              <div>
                <h2>₹{fmt(total)} a month</h2>
                <p>{used.length} of {rows.length} lines, {meta.from} to {meta.to}, about {months} {months === 1 ? 'month' : 'months'}.{meta.skipped > 0 ? ` Left out ${meta.skipped} payments, fees and interest.` : ''}{sorting ? ' Sorting the lines we did not recognise.' : ''}</p>
              </div>
              <button type="button" className="st-link" onClick={() => setRows(null)}>Start again</button>
            </div>
            <div className="st-bars">
              {CATS.filter(c => (spend[c] ?? 0) > 0).sort((a, b) => (spend[b] ?? 0) - (spend[a] ?? 0)).map(c => (
                <div key={c} className="st-bar"><span>{CAT_LABEL[c]}</span><i style={{ width: `${Math.max(3, ((spend[c] ?? 0) / (total || 1)) * 100)}%` }} /><b>₹{fmt(spend[c] ?? 0)}</b></div>
              ))}
            </div>
            <button type="button" className="st-link" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide the lines' : 'Check the lines and fix any category'}</button>
            {open && (
              <div className="st-lines" role="table" aria-label="Statement lines">
                {rows.map((r, i) => (
                  <div className="st-line" role="row" key={i}>
                    <input type="checkbox" checked={r.on} onChange={e => setRows(rs => rs!.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} aria-label={`Count ${r.desc}`} />
                    <span className="st-d">{r.desc}<small>{r.date}</small></span>
                    <div className="st-sel"><Select value={r.cat} onChange={e => setRows(rs => rs!.map((x, k) => (k === i ? { ...x, cat: e.target.value as Cat } : x)))}>{CATS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</Select></div>
                    <b>₹{fmt(r.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </section>

          {suggestion && (
            <section className="st-best" aria-label="What we suggest">
              <div className="st-head">
                <div>
                  <h2>{suggestion.basketWins ? `A basket of ${suggestion.basket.length} cards fits this spend` : 'One card fits this spend'}</h2>
                  <p>
                    {suggestion.basketWins
                      ? `${suggestion.basket.length} cards earn about ${fmt(Math.round(suggestion.basketMiles - suggestion.oneMiles))} more miles a month than the best single card, for ₹${fmt(suggestion.basketFee - suggestion.oneFee)} more in yearly fees.`
                      : suggestion.basket.length > 1
                        ? `A second card would add only about ${fmt(Math.round(suggestion.basketMiles - suggestion.oneMiles))} miles a month, so one card is simpler.`
                        : 'Nothing else adds enough to be worth a second card.'}
                  </p>
                </div>
              </div>
              <div className="st-cats">
                <div className="st-cat">
                  <div><b>One card</b><small>Simplest</small></div>
                  <div className="st-pick">
                    <span className="st-k">{suggestion.basketWins ? 'Single card' : 'Our pick'}</span>
                    <b>{suggestion.one.name}</b>
                    <small>{suggestion.one.bank} · {feeTier(suggestion.oneFee).label}</small>
                    <small className="st-m">+{fmt(Math.round(suggestion.oneMiles))} miles a month{held.includes(suggestion.one.card_id) ? ' · you hold this' : ''}</small>
                  </div>
                </div>
                {suggestion.basket.length > 1 && (
                  <div className="st-cat">
                    <div><b>A basket of {suggestion.basket.length}</b><small>Best card for each use</small></div>
                    {suggestion.basket.map(b => (
                      <div className="st-pick" key={b.card.card_id}>
                        <b>{b.card.name}</b>
                        <small>{b.covers.length ? `For ${b.covers.slice(0, 3).join(', ')}` : 'Backup card'}{held.includes(b.card.card_id) ? ' · you hold this' : ''}</small>
                      </div>
                    ))}
                    <small className="st-m">+{fmt(Math.round(suggestion.basketMiles))} miles a month in all</small>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="st-best" aria-label="Best card for each kind of spend">
            <div className="st-head">
              <div>
                <h2>Best card for each kind of spend</h2>
                <p>{held.length ? 'Counting the cards in your wallet.' : 'Add your cards in Wallet and we compare against them.'}</p>
              </div>
              <div className="st-air"><Select value={prog} onChange={e => setProg(e.target.value)}><option value="">Any airline</option>{programmes.map(p => <option key={p.id} value={p.id}>Miles on {p.name}</option>)}</Select></div>
            </div>
            <div className="st-cats">
              {perCat.map(({ cat, amount, best, mine }) => (
                <div className="st-cat" key={cat}>
                  <div><b>{CAT_LABEL[cat]}</b><small>₹{fmt(amount)} a month</small></div>
                  {best ? (
                    <div className="st-pick">
                      <span className="st-k">Best card</span>
                      <b>{best.card.name}</b>
                      <small>{(best.card as CalcEntry).bank} · {feeTier(fees[best.card.card_id]).label}</small>
                      <small className="st-m">+{fmt(Math.round(best.miles))} miles a month{held.includes(best.card.card_id) ? ' · you hold this' : ''}</small>
                    </div>
                  ) : <small>No card earns miles on this.</small>}
                  {mine && mine.card.card_id !== best?.card.card_id && <small className="st-mine">Your best: {mine.card.name}, +{fmt(Math.round(mine.miles))} miles</small>}
                  {!mine && held.length > 0 && <small className="st-mine">None of your cards earn miles here.</small>}
                </div>
              ))}
            </div>
            {uplift > 0 && held.length > 0 && <p className="st-up">Using the best card for each kind of spend could add about <b>{fmt(Math.round(uplift))}</b> miles a month over your current cards.</p>}
            <div className="a-r a-rw">
              <button type="button" className="a-cta" onClick={useInRecommender}>Use this in Best card for you</button>
              <Link className="cm-btn cm-btn--secondary" href="/earn/calculator">Open the points calculator</Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
