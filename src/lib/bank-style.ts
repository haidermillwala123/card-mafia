// Two-colour gradients for card visuals in the wallet, keyed by bank id. Our own colours, not bank logos or trademarks.
const STYLE: Record<string, [string, string]> = {
  hdfc: ['#0b2a6f', '#2a63cf'], axis: ['#5e0f2c', '#b3234f'], amex: ['#39414d', '#98a3b3'], icici: ['#7a2410', '#e2802a'],
  sbi: ['#103d8c', '#3f93e6'], hsbc: ['#171717', '#c8102e'], yes: ['#0a3a85', '#2d7bdc'], indusind: ['#6d1020', '#d23d4e'],
  kotak: ['#9a1220', '#ee4a4a'], au: ['#4f2380', '#a56bdc'], rbl: ['#0d3556', '#2c88c8'], jupiter: ['#3f2491', '#8b5cf6'],
};
export const bankGradient = (bank: string) => {
  const [a, b] = STYLE[bank] ?? ['#1a2b49', '#3b6bb5'];
  return `linear-gradient(135deg, ${a}, ${b})`;
};
