// Which city photo (public/cities/<id>.webp) belongs to an airport, so result cards show a real place when we have one.
// Only airports in these cities have a photo; everything else returns null and the card shows its airport code instead.
const BY_AIRPORT: Record<string, string> = {
  DXB: 'dubai', DWC: 'dubai',
  JFK: 'newyork', EWR: 'newyork', LGA: 'newyork',
  LHR: 'london', LGW: 'london', STN: 'london', LCY: 'london',
  LIS: 'lisbon',
  SIN: 'singapore',
  CDG: 'paris', ORY: 'paris',
  BKK: 'bangkok', DMK: 'bangkok',
  IST: 'istanbul', SAW: 'istanbul',
  SYD: 'sydney',
  DPS: 'bali',
  MLE: 'maldives',
  HND: 'japan', NRT: 'japan', KIX: 'japan', NGO: 'japan', FUK: 'japan', CTS: 'japan',
  HKG: 'hongkong', DOH: 'doha', MCT: 'muscat', KUL: 'kualalumpur', FCO: 'rome', CIA: 'rome', MXP: 'milan', LIN: 'milan',
  AMS: 'amsterdam', FRA: 'frankfurt', BER: 'berlin', BCN: 'barcelona', ATH: 'athens', VIE: 'vienna', PRG: 'prague', BUD: 'budapest',
  CPH: 'copenhagen', ARN: 'stockholm', HEL: 'helsinki', DUB: 'dublin', YYZ: 'toronto', SFO: 'sanfrancisco', LAX: 'losangeles',
  MEX: 'mexicocity', GIG: 'rio', CPT: 'capetown', CAI: 'cairo', RUH: 'riyadh', TBS: 'tbilisi', MRU: 'mauritius', SEZ: 'seychelles',
  CMB: 'colombo', KTM: 'kathmandu', PBH: 'paro', REP: 'angkor', TPE: 'taipei', PVG: 'shanghai', SHA: 'shanghai', MEL: 'melbourne', AKL: 'auckland',
};

export const cityPhoto = (iata: string): string | null => BY_AIRPORT[iata] ?? null;
