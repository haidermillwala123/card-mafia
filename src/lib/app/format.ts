// Display helpers. Indian digit grouping for every number, rupees with the symbol, ages in plain words.
export const fmt = (n: number) => n.toLocaleString('en-IN');
export const inr = (n: number | null | undefined) => (n === null || n === undefined ? null : `₹${fmt(n)}`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateShort = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const timeLabel = (iso: string | null) => (iso ? iso.slice(11, 16) : null);
export const duration = (min: number | null) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : null);

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const addDaysIso = (days: number, from = todayIso()) => new Date(new Date(`${from}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
// first and last day of a YYYY-MM month, so "December" becomes a date range
export const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return { from: `${ym}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
};

export const ageMinutes = (iso: string, now = Date.now()) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
export const ageLabel = (iso: string, now = Date.now()) => {
  const m = ageMinutes(iso, now);
  return m < 90 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
// seats older than a day get a warning
export const isStale = (iso: string, now = Date.now()) => ageMinutes(iso, now) > 1440;

export const CABIN_LABEL: Record<string, string> = { economy: 'Economy', premium_economy: 'Premium economy', business: 'Business', first: 'First' };

// Value per point = (cash fare - taxes) / points. Computed from a fare the person types; never shown without one.
export const valuePerPoint = (fare: number, taxes: number, points: number) => (points > 0 && fare > taxes ? Math.round(((fare - taxes) / points) * 100) / 100 : null);
