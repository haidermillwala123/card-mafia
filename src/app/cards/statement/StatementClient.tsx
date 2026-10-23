'use client';

// Statement to spend to card: read a statement (PDF or pasted lines), let the person fix any category, then show which card earns the most
// on each kind of spend, counting the cards they already hold. The statement is read in memory and never stored.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CalcEntry, MilesRate } from '@/app/earn/EarnCalculator';
import Select from '@/components/Select';
import { Note } from '@/components/app/ui';
import { fmt } from '@/lib/app/format';
import { useWallet } from '@/lib/app/wallet';
import { CAT_LABEL, CATS, type Cat } from '@/lib/earn';
import { feeTier } from '@/lib/fees';
import { recommend } from '@/lib/recommend';
import { detectCard, monthlySpend, monthsCovered, parseStatementText, type Txn } from '@/lib/statement';

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
  const [stmtCard, setStmtCard] = useState(''); // the card this statement belongs to, read from the PDF when it names one
  const [detected, setDetected] = useState(false);

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
    const j = (await res?.json().catch(() => null)) as { txns?: Txn[]; from?: string | null; to?: string | null; skipped?: number; error?: string; needsPassword?: boolean; cardId?: string | null } | null;
    setBusy(false);
    if (!res?.ok || !j?.txns) {
      setNeedsPassword(!!j?.needsPassword);
      return setError(j?.error ?? 'We could not reach the server. Try again.');
    }
    setNeedsPassword(false);
    setStmtCard(j.cardId ?? '');
    setDetected(!!j.cardId);
    load(j.txns, j.from ?? null, j.to ?? null, j.skipped ?? 0);
  }

  function readPasted() {
    const p = parseStatementText(pasted);
    if (!p.txns.length) return setError('We found no transactions. Each line needs a date, a merchant and an amount, like 12/10/2026 SWIGGY 1,245.00.');
    const d = detectCard(pasted, cards.map(c => ({ id: c.card_id, bank: (c as CalcEntry).bank, name: c.name })));
    setStmtCard(d.cardId ?? '');
    setDetected(!!d.cardId);
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
  // A fair comparison only counts cards with a similar yearly fee to the statement's card (never under ₹5,000), or cards the person already holds.
  // Without this rule the best card for a small spend is always the most expensive one, which is not advice anyone would trust.
  const feeLimit = Math.max(fees[stmtCard] ?? 0, 5000);
  const fair = useCallback((id: string) => id === stmtCard || held.includes(id) || (fees[id] ?? 0) <= feeLimit, [stmtCard, held, fees, feeLimit]);

  // Built on the statement's own card when it is known, so the headline and the line verdicts below always agree.
  // It starts from that card and adds up to two more, each only if it lifts total monthly miles by a real amount.
  const suggestion = useMemo(() => {
    if (!perCat.length) return null;
    const milesOf = (id: string, pc: (typeof perCat)[number]) => pc.picks.find(p => p.card.card_id === id)?.miles ?? 0;
    const ids = [...new Set([...(stmtCard ? [stmtCard] : []), ...perCat.flatMap(pc => pc.picks.filter(p => fair(p.card.card_id)).slice(0, 8).map(p => p.card.card_id))])];
    const score = (set: string[]) => perCat.reduce((s, pc) => s + Math.max(0, ...set.map(id => milesOf(id, pc))), 0);
    const byId = (id: string) => cards.find(c => c.card_id === id)!;
    let oneId = ids[0], oneScore = -1;
    for (const id of ids) { const v = score([id]); if (v > oneScore) { oneScore = v; oneId = id; } }
    if (!oneId || !byId(oneId)) return null;
    const set: string[] = stmtCard ? [stmtCard] : [];
    let cur = score(set);
    const base = stmtCard ? cur : oneScore;
    if (!stmtCard) { set.push(oneId); cur = oneScore; }
    while (set.length < 3) {
      let pick = '', top = cur;
      for (const id of ids) if (!set.includes(id)) { const v = score([...set, id]); if (v > top) { top = v; pick = id; } }
      if (!pick || top - cur < Math.max(300, cur * 0.08)) break;
      set.push(pick);
      cur = top;
    }
    const covers = (id: string) => perCat.filter(pc => set.every(o => milesOf(o, pc) <= milesOf(id, pc))).map(pc => CAT_LABEL[pc.cat]);
    return {
      current: stmtCard && byId(stmtCard) ? { card: byId(stmtCard), miles: base, fee: fees[stmtCard] ?? 0 } : null,
      one: byId(oneId), oneMiles: oneScore, oneFee: fees[oneId] ?? 0,
      basket: set.map(id => ({ card: byId(id), covers: covers(id) })), basketMiles: cur, basketFee: set.reduce((s, id) => s + (fees[id] ?? 0), 0),
      basketWins: set.length > 1 && cur >= base * 1.2,
      switchWins: !!stmtCard && oneId !== stmtCard && oneScore >= base * 1.15,
      base,
    };
  }, [perCat, cards, fees, stmtCard, fair]);
  // Line by line: what the statement's card earned against the best fairly-priced card for that kind of spend. Rates are per rupee over the whole statement, so caps are averaged in.
  const verdicts = useMemo(() => {
    const out = new Map<number, { better: boolean; name: string; fee: string; gain: number; mine: number }>();
    if (!rows || !stmtCard) return { out, total: 0, better: 0, counted: 0, stretch: 0 };
    let total = 0, better = 0, counted = 0, stretch = 0;
    rows.forEach((r, i) => {
      const pc = perCat.find(p => p.cat === r.cat);
      const bestFair = pc?.picks.find(p => fair(p.card.card_id));
      if (!r.on || !pc || !bestFair || !pc.amount) return;
      const rate = (id: string) => (pc.picks.find(p => p.card.card_id === id)?.miles ?? 0) / pc.amount;
      const mine = rate(stmtCard) * r.amount, top = rate(bestFair.card.card_id) * r.amount;
      const gain = top - mine;
      counted++;
      const isBetter = bestFair.card.card_id !== stmtCard && gain >= Math.max(10, top * 0.1);
      if (isBetter) { total += gain; better++; }
      const priciest = pc.picks[0];
      if (priciest && !fair(priciest.card.card_id) && rate(priciest.card.card_id) * r.amount - mine >= Math.max(10, mine * 0.1)) stretch++;
      out.set(i, { better: isBetter, name: bestFair.card.name, fee: feeTier(fees[bestFair.card.card_id]).label, gain, mine });
    });
    return { out, total, better, counted, stretch };
  }, [rows, perCat, stmtCard, fees, fair]);
  const stmtName = cards.find(c => c.card_id === stmtCard)?.name;
  // the per-kind table follows the same fairness rule once a statement card is known
  const shownCat = useMemo(() => perCat.map(pc => ({ ...pc, best: stmtCard ? pc.picks.find(p => fair(p.card.card_id)) ?? pc.best : pc.best })), [perCat, stmtCard, fair]);
  const uplift = shownCat.reduce((s, p) => s + Math.max(0, (p.best?.miles ?? 0) - (p.mine?.miles ?? 0)), 0);

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
            <div className="st-air">
              <Select value={stmtCard} onChange={e => { setStmtCard(e.target.value); setDetected(false); }}>
                <option value="">Which card is this statement from?</option>
                {cards.slice().sort((a, b) => `${(a as CalcEntry).bank} ${a.name}`.localeCompare(`${(b as CalcEntry).bank} ${b.name}`)).map(c => <option key={c.card_id} value={c.card_id}>{(c as CalcEntry).bank} {c.name}</option>)}
              </Select>
            </div>
            {stmtCard && (
              <p className="st-up">
                {detected ? `Read from the statement: ${stmtName}. ` : `Checking against ${stmtName}. `}
                {verdicts.better > 0
                  ? <>On {verdicts.better} of {verdicts.counted} lines a different card would have earned more, about <b>{fmt(Math.round(verdicts.total))}</b> extra miles over this statement. The rest were already on the right card.</>
                  : verdicts.counted > 0 ? 'Every line was already on the best card for it.' : null}
              </p>
            )}
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
                    <span className="st-d">{r.desc}<small>{r.date}{(() => { const v = verdicts.out.get(i); return v ? (v.better ? ` · ${v.name} (${v.fee}) would earn about ${fmt(Math.round(v.gain))} more miles` : ' · right card for this') : ''; })()}</small></span>
                    <div className="st-sel"><Select value={r.cat} onChange={e => setRows(rs => rs!.map((x, k) => (k === i ? { ...x, cat: e.target.value as Cat } : x)))}>{CATS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</Select></div>
                    <b>₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>
                ))}
              </div>
            )}
          </section>

          {suggestion && (
            <section className="st-best" aria-label="What we suggest">
              <div className="st-head">
                <div>
                  <h2>
                    {suggestion.switchWins ? `${suggestion.one.name} suits this spend better than ${stmtName}`
                      : suggestion.basketWins ? (suggestion.current ? `Keep ${stmtName} and add ${suggestion.basket.length - 1 === 1 ? 'one more card' : `${suggestion.basket.length - 1} more cards`}` : `A basket of ${suggestion.basket.length} cards fits this spend`)
                        : suggestion.current ? `${stmtName} is the right card for this spend` : 'One card fits this spend'}
                  </h2>
                  <p>
                    {suggestion.switchWins
                      ? `It earns about ${fmt(Math.round(suggestion.oneMiles - suggestion.base))} more miles a month than ${stmtName} on the same spend, for a ${feeTier(suggestion.oneFee).label.toLowerCase()} fee.`
                      : suggestion.basketWins
                        ? `Together they earn about ${fmt(Math.round(suggestion.basketMiles - suggestion.base))} more miles a month than ${suggestion.current ? stmtName : 'the best single card'} alone, for ₹${fmt(Math.max(0, suggestion.basketFee - (suggestion.current ? suggestion.current.fee : suggestion.oneFee)))} more in yearly fees.`
                        : 'No card with a similar fee earns meaningfully more, and a second card would add very little.'}
                    {verdicts.stretch > 0 ? ` On ${verdicts.stretch} ${verdicts.stretch === 1 ? 'line' : 'lines'} a card with a much higher yearly fee would earn more; we left those out.` : ''}
                  </p>
                </div>
              </div>
              <div className="st-cats">
                {suggestion.current && (
                  <div className="st-cat">
                    <div><b>Card on this statement</b><small>What you used</small></div>
                    <div className="st-pick">
                      <b>{suggestion.current.card.name}</b>
                      <small>{suggestion.current.card.bank} · {feeTier(suggestion.current.fee).label}</small>
                      <small className="st-m">+{fmt(Math.round(suggestion.current.miles))} miles a month on this spend</small>
                    </div>
                  </div>
                )}
                {(suggestion.switchWins || !suggestion.current) && (
                <div className="st-cat">
                  <div><b>One card</b><small>Simplest</small></div>
                  <div className="st-pick">
                    <span className="st-k">{suggestion.basketWins ? 'Single card' : 'Our pick'}</span>
                    <b>{suggestion.one.name}</b>
                    <small>{suggestion.one.bank} · {feeTier(suggestion.oneFee).label}</small>
                    <small className="st-m">+{fmt(Math.round(suggestion.oneMiles))} miles a month{held.includes(suggestion.one.card_id) ? ' · you hold this' : ''}</small>
                  </div>
                </div>
                )}
                {suggestion.basketWins && (
                  <div className="st-cat">
                    <div><b>{suggestion.current ? 'Your card plus' : `A basket of ${suggestion.basket.length}`}</b><small>Best card for each use</small></div>
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
                <p>
                  {prog ? `Ranked by ${programmes.find(p => p.id === prog)?.name ?? 'your airline'} miles: the points a card earns in that kind of spend, times how well those points transfer there. ` : 'Ranked by the average miles across the main airlines. Pick an airline to rank for one programme. '}
                  {held.length ? 'Counting the cards in your wallet.' : 'Add your cards in Wallet and we compare against them.'}
                </p>
              </div>
              <div className="st-air"><Select value={prog} onChange={e => setProg(e.target.value)}><option value="">Any airline</option>{programmes.map(p => <option key={p.id} value={p.id}>Miles on {p.name}</option>)}</Select></div>
            </div>
            <div className="st-cats">
              {shownCat.map(({ cat, amount, best, mine, picks }) => (
                <div className="st-cat" key={cat}>
                  <div><b>{CAT_LABEL[cat]}</b><small>₹{fmt(amount)} a month</small></div>
                  {best ? (
                    <div className="st-pick">
                      <span className="st-k">Best card</span>
                      <b>{best.card.name}</b>
                      <small>{(best.card as CalcEntry).bank} · {feeTier(fees[best.card.card_id]).label}</small>
                      <small className="st-m">+{fmt(Math.round(best.miles))} miles a month{held.includes(best.card.card_id) ? ' · you hold this' : ''}</small>
                      {best.perPoint > 0 && amount > 0 && (
                        <small className="st-why">
                          Earns about {(Math.round((best.miles / amount / best.perPoint) * 1000) / 10).toLocaleString('en-IN')} points per ₹100 here; 1 point becomes {Math.round(best.perPoint * 100) / 100} {programmes.find(p => p.id === best.programme)?.name ?? 'airline'} miles.
                        </small>
                      )}
                      {(() => {
                        const next = picks.find(p => p.card.card_id !== best.card.card_id && fair(p.card.card_id));
                        return next ? <small className="st-why">Next best: {next.card.name}, +{fmt(Math.round(next.miles))} miles.</small> : null;
                      })()}
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
