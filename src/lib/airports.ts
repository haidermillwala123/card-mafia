import list from '@/data/airports.json';

export type Airport = { i: string; c: string; k: string; g: string };
export const AIRPORTS = list as Airport[];

export const GROUPS: { id: string; label: string }[] = [
  { id: 'india', label: 'India' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'europe', label: 'Europe' },
  { id: 'north-america', label: 'North America' },
  { id: 'east-asia', label: 'East Asia' },
  { id: 'southeast-asia', label: 'Southeast Asia' },
  { id: 'south-asia', label: 'South Asia' },
  { id: 'oceania', label: 'Oceania' },
  { id: 'africa', label: 'Africa' },
  { id: 'south-america', label: 'South America' },
];

// Airports seats.aero returns no award seats for (checked 22 Oct 2026), and the nearest airports it does cover.
export const NEAR: Record<string, string[]> = { OSL: ['CPH', 'ARN', 'HEL'] };

export const airport = (iata: string) => AIRPORTS.find(a => a.i === iata);
export const cityOf = (iata: string) => airport(iata)?.c ?? iata;
export const label = (iata: string) => `${cityOf(iata)} (${iata})`;
export const inGroup = (group: string) => AIRPORTS.filter(a => a.g === group).map(a => a.i);
export const INDIAN = inGroup('india');

// "To Europe" or "To LHR": a region id or an airport code becomes the list of airports to search.
export const expandDest = (v: string): string[] => (GROUPS.some(g => g.id === v) ? inGroup(v) : [v]);
