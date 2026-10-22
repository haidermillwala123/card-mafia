// Places people can go. One list for the home hero, the "Where to fly" gallery and the trip search, so they never drift apart.
// `photo` is the file in public/cities (<photo>.webp and <photo>-sm.webp); credits live in src/data/photo_credits.json.
export type Destination = { id: string; photo: string; name: string; country: string; sub: string; d: string; shape?: 'big' | 'wide' | 'tall' };

export const DESTINATIONS: Destination[] = [
  { id: 'dubai', photo: 'dubai', name: 'Dubai', country: 'United Arab Emirates', sub: 'Skyline and desert', d: 'DXB', shape: 'big' },
  { id: 'london', photo: 'london', name: 'London', country: 'United Kingdom', sub: 'Tower Bridge', d: 'LHR' },
  { id: 'singapore', photo: 'singapore', name: 'Singapore', country: 'Singapore', sub: 'Marina Bay at night', d: 'SIN' },
  { id: 'paris', photo: 'paris', name: 'Paris', country: 'France', sub: 'The Seine at dusk', d: 'CDG', shape: 'tall' },
  { id: 'maldives', photo: 'maldives', name: 'Maldives', country: 'Maldives', sub: 'Islands and lagoons', d: 'MLE', shape: 'wide' },
  { id: 'bali', photo: 'bali', name: 'Bali', country: 'Indonesia', sub: 'Tanah Lot temple', d: 'DPS' },
  { id: 'sydney', photo: 'sydney', name: 'Sydney', country: 'Australia', sub: 'Opera House and the bridge', d: 'SYD' },
  { id: 'japan', photo: 'japan', name: 'Japan', country: 'Japan', sub: 'Fuji and Tokyo', d: 'HND', shape: 'wide' },
  { id: 'newyork', photo: 'newyork', name: 'New York', country: 'United States', sub: 'Manhattan', d: 'JFK', shape: 'wide' },
  { id: 'bangkok', photo: 'bangkok', name: 'Bangkok', country: 'Thailand', sub: 'Wat Arun', d: 'BKK' },
  { id: 'istanbul', photo: 'istanbul', name: 'Istanbul', country: 'Türkiye', sub: 'Two continents, one skyline', d: 'IST' },
  { id: 'lisbon', photo: 'lisbon', name: 'Lisbon', country: 'Portugal', sub: 'Hills and tiles', d: 'LIS', shape: 'wide' },
];

// The pinned hero on the app home cycles through these, in this order. Eight is enough to feel wide without a never-ending scroll.
export const HERO_IDS = ['dubai', 'london', 'singapore', 'paris', 'maldives', 'bali', 'sydney', 'japan'];
export const HERO: Destination[] = HERO_IDS.map(id => DESTINATIONS.find(x => x.id === id)!);
