// Where the statement's money went, as a donut with its legend. Small slices fold into "Other" so the chart stays readable.
// Slices follow the rupee amounts the person has already confirmed; nothing here is estimated.
import { CAT_LABEL, type Cat } from '@/lib/earn';
import './pie.css';

const COLOURS = ['#7FC4CC', '#E3B26B', '#8FA8D6', '#E08E7B', '#9CCB8B', '#C79BD6', '#E6D36B', '#7C8798'];
const R = 70;
const C = 2 * Math.PI * R;
const inr = (n: number) => Math.round(n).toLocaleString('en-IN');

export default function SpendPie({ spend }: { spend: Partial<Record<Cat, number>> }) {
  const total = Object.values(spend).reduce((s, v) => s + (v ?? 0), 0);
  if (total <= 0) return null;
  const sorted = (Object.entries(spend) as [Cat, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  // keep the biggest seven; everything after folds into one grey slice
  const head = sorted.slice(0, 7).map(([cat, v]) => ({ label: CAT_LABEL[cat], v }));
  const rest = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
  const slices = rest > 0 ? [...head, { label: 'Other', v: rest }] : head;
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((a, x) => a + (x.v / total) * C, 0));
  const label = `Spend by category: ${slices.map(s => `${s.label} ${Math.round((s.v / total) * 100)} percent`).join(', ')}`;

  return (
    <div className="sp">
      <svg className="sp-svg" viewBox="0 0 180 180" role="img" aria-label={label}>
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border)" strokeWidth="26" />
        {slices.map((s, i) => {
          const len = (s.v / total) * C;
          return <circle key={s.label} cx="90" cy="90" r={R} fill="none" stroke={COLOURS[i % COLOURS.length]} strokeWidth="26" strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`} strokeDashoffset={-starts[i]} transform="rotate(-90 90 90)" />;
        })}
        <text x="90" y="84" textAnchor="middle" className="sp-k">Total spend</text>
        <text x="90" y="108" textAnchor="middle" className="sp-v">₹{inr(total)}</text>
      </svg>
      <ul className="sp-leg">
        {slices.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: COLOURS[i % COLOURS.length] }} aria-hidden="true" />
            <span>{s.label}</span>
            <small>{Math.round((s.v / total) * 100)}%</small>
            <b>₹{inr(s.v)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
