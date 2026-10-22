// Annual fee as a plain label, so a number like 12500 reads as "Premium". Bands are ours; the fee itself is the researched figure.
export type FeeTier = { id: 'unknown' | 'free' | 'low' | 'mid' | 'premium' | 'luxury'; label: string; short: string };

export function feeTier(fee: number | null | undefined): FeeTier {
  if (fee === null || fee === undefined) return { id: 'unknown', label: 'Fee not found', short: 'Fee not found' };
  if (fee === 0) return { id: 'free', label: 'Lifetime free', short: 'Free' };
  if (fee <= 1000) return { id: 'low', label: `Low fee · ₹${fee.toLocaleString('en-IN')}`, short: 'Low fee' };
  if (fee <= 5000) return { id: 'mid', label: `Mid fee · ₹${fee.toLocaleString('en-IN')}`, short: 'Mid fee' };
  if (fee <= 15000) return { id: 'premium', label: `Premium · ₹${fee.toLocaleString('en-IN')}`, short: 'Premium' };
  return { id: 'luxury', label: `Luxury · ₹${fee.toLocaleString('en-IN')}`, short: 'Luxury' };
}
