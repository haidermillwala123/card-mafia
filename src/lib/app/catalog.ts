// Card and bank names for the client, from the two small JSON files only (not the 814 transfer rules).
import cardsJson from '@/data/cards.json';
import programmesJson from '@/data/programmes.json';

export type CatalogCard = { id: string; bank: string; name: string; programme: string; annual_fee_inr: number | null };
export const CARDS = cardsJson.cards as CatalogCard[];
export const BANKS = programmesJson.banks as { id: string; name: string }[];
export const PROGRAMME_OF_CARD: Record<string, string> = Object.fromEntries(CARDS.map(c => [c.id, c.programme]));

export const bankName = (id: string) => BANKS.find(b => b.id === id)?.name.replace(/ Bank| Card/, '') ?? id;
export const cardName = (id: string) => {
  const c = CARDS.find(x => x.id === id);
  return c ? `${bankName(c.bank)} ${c.name}`.trim() : id;
};
export const programmeName = (id: string) => (programmesJson.programmes as { id: string; name: string }[]).find(p => p.id === id)?.name ?? id;
