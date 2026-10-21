import type { Card, Data, Programme, Rule, Seat } from './engine';
import programmes from '@/data/programmes.json';
import cards from '@/data/cards.json';
import rules from '@/data/transfer_rules.json';
import qsuite from '@/data/qsuite_aircraft.json';
import seats from '@/data/seats_cache.json';

export const BANKS: { id: string; name: string }[] = programmes.banks;

export const data: Data = {
  rules: rules.rules as Rule[],
  rulesCheckedOn: rules.checked_on,
  cards: cards.cards as Card[],
  programmes: programmes.programmes as Programme[],
  qsuite: { types: qsuite.types as { type: string; fit: 'all' | 'some' }[], status: qsuite.status, verified_at: qsuite.verified_at },
  seats: { sample: seats.sample, fetched_at: seats.fetched_at, rows: seats.rows as Seat[] },
};

export const programmeName = (id: string) => data.programmes.find(p => p.id === id)?.name ?? id;
export const cardName = (id: string) => {
  const c = data.cards.find(x => x.id === id);
  return c ? `${BANKS.find(b => b.id === c.bank)?.name.replace(/ Bank| Card/, '') ?? ''} ${c.name}`.trim() : id;
};
