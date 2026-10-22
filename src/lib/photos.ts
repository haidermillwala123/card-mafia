// Which city photo (public/cities/<id>.webp) belongs to an airport, so result cards show a real place when we have one.
// Only airports in these five cities have a photo; everything else returns null and the card shows its airport code instead.
const BY_AIRPORT: Record<string, string> = {
  DXB: 'dubai', DWC: 'dubai',
  JFK: 'newyork', EWR: 'newyork', LGA: 'newyork',
  LHR: 'london', LGW: 'london', STN: 'london', LCY: 'london',
  LIS: 'lisbon',
  HND: 'japan', NRT: 'japan', KIX: 'japan', NGO: 'japan', FUK: 'japan', CTS: 'japan',
};

export const cityPhoto = (iata: string): string | null => BY_AIRPORT[iata] ?? null;
