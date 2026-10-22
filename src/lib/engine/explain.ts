// Plain-language text for a plan. The fallback is deterministic; Claude only rewrites these same facts.
import type { Plan, Transfer } from './engine';

type Name = (programmeId: string) => string;
const fmt = (n: number) => n.toLocaleString('en-IN');

export const chainText = (t: Transfer, name: Name) => [t.hops[0].from, ...t.hops.map(h => h.to)].map(name).join(' → ');
const ratios = (t: Transfer) => t.hops.map(h => `${h.ratio_in}:${h.ratio_out}`).join(', ');

export function explainFallback(p: Plan, name: Name): string {
  if (p.kind === 'get_card' && p.newCard) {
    const c = p.newCard;
    return `You are ${fmt(p.shortfallMiles)} miles short of this seat. ${c.cardName} reaches Qatar at ${c.ratioText}, so about ${fmt(c.sourcePointsForShortfall)} points on it would close the gap. Fees and welcome bonuses are not in our catalogue yet, so check them with the bank.`;
  }
  const moves = p.transfers.map(t => `${fmt(t.sourcePoints)} ${t.cardName} points via ${chainText(t, name)} (${ratios(t)})`).join(' and ');
  const gap = p.shortfallMiles > 0 ? ` That leaves you ${fmt(p.shortfallMiles)} miles short.` : '';
  const qs = p.qsuiteFit === 'all' ? 'Qsuite aircraft' : 'an aircraft type that may carry Qsuite';
  return `${moves ? `Move ${moves}.` : 'None of your cards reaches this seat.'} That lands ${fmt(p.milesCovered)} of the ${fmt(p.milesNeeded)} miles needed on ${p.seat.flights.join(', ')}, ${qs}.${gap}`;
}

// Every number in an AI sentence must appear in the facts it was written from (commas ignored, so 1,40,000 equals 140000).
export function numbersMatch(text: string, facts: unknown): boolean {
  const nums = (s: string) => (s.replace(/(?<=\d),(?=\d)/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const allowed = new Set(nums(JSON.stringify(facts)));
  return nums(text).every(n => allowed.has(n));
}

// What Claude is allowed to see: facts the rules produced, nothing else.
export const factsFor = (p: Plan, name: Name) => ({
  kind: p.kind,
  route: `Doha to ${p.seat.dest}`,
  date: p.seat.date,
  flight: p.seat.flights.join(', '),
  aircraft: p.seat.aircraft,
  qsuiteFit: p.qsuiteFit,
  milesNeeded: p.milesNeeded,
  shortfallMiles: p.shortfallMiles,
  transfers: p.transfers.map(t => ({ card: t.cardName, points: t.sourcePoints, path: chainText(t, name), ratios: ratios(t) })),
  newCard: p.newCard && { name: p.newCard.cardName, ratio: p.newCard.ratioText, pointsForShortfall: p.newCard.sourcePointsForShortfall },
  valuePerPoint: p.valuePerPoint,
  risks: p.risks.slice(0, 3),
});
