// seats.aero source names -> Card Mafia programme ids, cabins, and where to book.
// A source with no entry here is ignored: seat_snapshots.programme_id is a foreign key to programmes.

export type Cabin = 'economy' | 'premium_economy' | 'business' | 'first';

export const CABINS: Cabin[] = ['economy', 'premium_economy', 'business', 'first'];
export const CABIN_CODE: Record<Cabin, 'Y' | 'W' | 'J' | 'F'> = { economy: 'Y', premium_economy: 'W', business: 'J', first: 'F' };
// seats.aero's own cabin names for the `cabins` query parameter
export const CABIN_API: Record<Cabin, string> = { economy: 'economy', premium_economy: 'premium', business: 'business', first: 'first' };
export const CABIN_LABEL: Record<Cabin, string> = { economy: 'Economy', premium_economy: 'Premium economy', business: 'Business', first: 'First' };

export const SOURCE_PROGRAMME: Record<string, string> = {
  aeroplan: 'aeroplan',
  american: 'american-airlines-aadvantage',
  delta: 'delta-skymiles',
  united: 'united-mileageplus',
  emirates: 'emirates-skywards',
  etihad: 'etihad-guest',
  flyingblue: 'flying-blue',
  qatar: 'qatar-privilege-club',
  singapore: 'krisflyer',
  turkish: 'turkish-ms',
  velocity: 'velocity',
  qantas: 'qantas-ff',
  virginatlantic: 'virgin-flyingclub',
  lufthansa: 'miles-and-more',
  finnair: 'finnair-plus',
  eurobonus: 'sas-eurobonus',
  alaska: 'atmos-rewards',
  smiles: 'smiles-gol',
  aeromexico: 'aeromexico-rewards',
  ethiopian: 'shebamiles',
  saudia: 'saudia-alfursan',
  connectmiles: 'connectmiles',
  copa: 'connectmiles',
  frontier: 'frontier-miles',
  jetblue: 'trueblue',
  british: 'ba-executive-club',
  asiamiles: 'cathay-asiamiles',
  jal: 'jal-mileage-bank',
  lifemiles: 'lifemiles',
  eva: 'infinity-mileagelands',
  iberia: 'iberia-club',
};

export const programmeForSource = (source: string): string | null => SOURCE_PROGRAMME[source] ?? null;

// seats.aero does not return taxes or seat counts for these programmes
export const NO_TAXES_SOURCES = new Set(['qatar', 'turkish', 'singapore']);

// Each programme's own site. These are entry pages, not deep links, and none has been checked by hand yet
// (`checkedOn` stays null until a person confirms the link and sets a date).
export type Handoff = { name: string; url: string; checkedOn: string | null };
export const HANDOFF: Record<string, Handoff> = {
  aeroplan: { name: 'Air Canada Aeroplan', url: 'https://www.aircanada.com/aeroplan/redeem/', checkedOn: null },
  american: { name: 'American AAdvantage', url: 'https://www.aa.com/booking/find-flights', checkedOn: null },
  delta: { name: 'Delta SkyMiles', url: 'https://www.delta.com/flight-search/book-a-flight', checkedOn: null },
  united: { name: 'United MileagePlus', url: 'https://www.united.com/', checkedOn: null },
  emirates: { name: 'Emirates Skywards', url: 'https://www.emirates.com/in/english/book/', checkedOn: null },
  etihad: { name: 'Etihad Guest', url: 'https://www.etihad.com/en-in/book', checkedOn: null },
  flyingblue: { name: 'Flying Blue', url: 'https://www.flyingblue.com/en', checkedOn: null },
  qatar: { name: 'Qatar Airways Privilege Club', url: 'https://www.qatarairways.com/en-in/homepage.html', checkedOn: null },
  singapore: { name: 'Singapore Airlines KrisFlyer', url: 'https://www.singaporeair.com/en_UK/in/home', checkedOn: null },
  turkish: { name: 'Turkish Miles&Smiles', url: 'https://www.turkishairlines.com/en-in/miles-and-smiles/', checkedOn: null },
  velocity: { name: 'Virgin Australia Velocity', url: 'https://www.velocityfrequentflyer.com/', checkedOn: null },
  qantas: { name: 'Qantas Frequent Flyer', url: 'https://www.qantas.com/in/en.html', checkedOn: null },
  virginatlantic: { name: 'Virgin Atlantic Flying Club', url: 'https://www.virginatlantic.com/', checkedOn: null },
  lufthansa: { name: 'Lufthansa Miles & More', url: 'https://www.miles-and-more.com/row/en.html', checkedOn: null },
  finnair: { name: 'Finnair Plus', url: 'https://www.finnair.com/en', checkedOn: null },
  eurobonus: { name: 'SAS EuroBonus', url: 'https://www.flysas.com/en/', checkedOn: null },
  alaska: { name: 'Alaska Atmos Rewards', url: 'https://www.alaskaair.com/', checkedOn: null },
  smiles: { name: 'Smiles', url: 'https://www.smiles.com.br/', checkedOn: null },
  aeromexico: { name: 'Aeromexico Rewards', url: 'https://www.aeromexico.com/', checkedOn: null },
  ethiopian: { name: 'Ethiopian ShebaMiles', url: 'https://www.ethiopianairlines.com/', checkedOn: null },
  saudia: { name: 'Saudia AlFursan', url: 'https://www.saudia.com/', checkedOn: null },
  connectmiles: { name: 'Copa ConnectMiles', url: 'https://www.copaair.com/', checkedOn: null },
  copa: { name: 'Copa ConnectMiles', url: 'https://www.copaair.com/', checkedOn: null },
  frontier: { name: 'Frontier Miles', url: 'https://www.flyfrontier.com/', checkedOn: null },
  jetblue: { name: 'JetBlue TrueBlue', url: 'https://www.jetblue.com/', checkedOn: null },
  british: { name: 'British Airways Executive Club', url: 'https://www.britishairways.com/', checkedOn: null },
  asiamiles: { name: 'Cathay Asia Miles', url: 'https://www.asiamiles.com/', checkedOn: null },
  jal: { name: 'JAL Mileage Bank', url: 'https://www.jal.co.jp/', checkedOn: null },
  lifemiles: { name: 'Avianca LifeMiles', url: 'https://www.lifemiles.com/', checkedOn: null },
  eva: { name: 'EVA Infinity MileageLands', url: 'https://www.evaair.com/', checkedOn: null },
  iberia: { name: 'Iberia Club', url: 'https://www.iberia.com/', checkedOn: null },
};

// seats.aero shows no flight more than 60 days out to third parties without its OAuth flow or a commercial agreement
export const MAX_DAYS_OUT = 60;
