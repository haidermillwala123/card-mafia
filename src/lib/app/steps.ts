// The ordered steps between "I picked a seat" and "I book it": every transfer hop from the card to the airline programme, a wait after
// each, then the booking. Built only from the seat's own transfer chain and the rules behind it (ratio, block size, transfer time).
// Nothing here is invented: a rule with no stated transfer time says "check the transfer time", never a guess.
import type { SeatView } from './api';

export type Step = { title: string; note?: string; link?: { label: string; href: string } };
export type Plan = { steps: Step[]; direct: boolean };

// Bank rewards sites where points are moved to partner programmes. Only banks whose address we are sure of; any other bank gets plain wording.
// `path` is what to click once there, only where a published guide gives it (ICICI and SBI: points.casa and card guides, Oct 2026).
const PORTAL: Record<string, { label: string; href: string; path?: string }> = {
  hdfc: { label: 'Open HDFC SmartBuy rewards', href: 'https://offers.smartbuy.hdfcbank.com/' },
  axis: { label: 'Open Axis EDGE Rewards', href: 'https://edgerewards.axisbank.com/' },
  amex: { label: 'Open Amex Membership Rewards', href: 'https://global.americanexpress.com/rewards' },
  icici: { label: 'Open ICICI internet banking', href: 'https://infinity.icicibank.com/', path: 'Go to Cards, then ICICI Bank Rewards, then Redeem Now, and choose the airline.' },
  sbi: { label: 'Open SBI Card', href: 'https://www.sbicard.com/', path: 'Go to Rewards, then Air Miles, pick the programme, link your membership number the first time, enter the points and press Transfer Now.' },
};
const NO_PORTAL = "Open your bank's net banking or card app, find Rewards, and look for the airline or hotel transfer option. If you cannot find it, ask your bank.";

// Avios programmes cannot send points straight to each other: they move through British Airways Club, on BA's Combine Avios page.
// From BA and Finnair's help pages (Oct 2026): accounts must carry the same name, a Finnair Plus account must be at least 30 days old
// before it can be linked, and moves between your own accounts are free and usually immediate.
const AVIOS = new Set(['finnair-plus', 'qatar-privilege-club', 'ba-executive-club', 'iberia-club']);
const BA = 'ba-executive-club';
const COMBINE = { label: "Open BA's Combine Avios page", href: 'https://www.britishairways.com/content/the-british-airways-club/avios/combine-avios' };
const fmt = (n: number) => n.toLocaleString('en-IN');

export function stepsFor(o: {
  r: SeatView; programme: string; n: number; held: number | null;
  nameOf: (programmeId: string) => string; bankOf: (cardId: string) => string | undefined;
}): Plan {
  const { r } = o;
  const need = r.miles * o.n;
  const flights = r.flights.length ? `flight ${r.flights.join(' and ')}` : 'the flight shown here';
  const book: Step = { title: `Book on ${o.programme}`, note: `Search ${r.origin} to ${r.dest} on ${r.date}, pick ${flights}, and check the taxes before you pay.` };

  // points already sitting in the airline programme (saved in Wallet): nothing to transfer
  if (o.held !== null && o.held >= need) {
    return {
      direct: true,
      steps: [
        { title: `You already have ${fmt(o.held)} points in ${o.programme}`, note: `That covers the ${fmt(need)} this seat needs (the balance saved in your Wallet). You do not need to transfer anything: book directly.` },
        book,
      ],
    };
  }

  const steps: Step[] = [];
  const x = r.reach;
  const how = (h: { ratio: string; minMultiple?: number | null; transferTime?: string | null }) =>
    [`Ratio ${h.ratio}.`, h.minMultiple ? `Points move in blocks of ${fmt(h.minMultiple)}.` : '', h.transferTime ? `Takes ${h.transferTime.toLowerCase()}.` : 'The rules do not state a transfer time: check it on the site.']
      .filter(Boolean).join(' ');

  if (x?.status === 'ok' && x.best) {
    const best = x.best;
    best.hops.forEach((h, i) => {
      const viaBa = i > 0 && AVIOS.has(h.from) && AVIOS.has(h.to);
      if (i === 0) {
        const portal = PORTAL[o.bankOf(best.cardId) ?? ''];
        steps.push({
          title: `Transfer ${fmt(h.pointsIn)} ${best.cardName} points to ${o.nameOf(h.to)}`,
          note: `${how(h)} You need an account with ${o.nameOf(h.to)} first, in the same name as your card. ${portal?.path ?? (portal ? '' : NO_PORTAL)}`.trim(),
          link: portal ? { label: portal.label, href: portal.href } : undefined,
        });
      } else if (viaBa) {
        // Avios to Avios: through British Airways Club, unless one end already is BA
        const legs = h.from !== BA && h.to !== BA ? [[h.from, BA], [BA, h.to]] : [[h.from, h.to]];
        legs.forEach(([from, to], k) => {
          steps.push({
            title: `Move ${fmt(h.pointsIn)} Avios from ${o.nameOf(from)} to ${o.nameOf(to)}`,
            note: `${k === 0 ? 'Avios cannot go straight between these two programmes: they pass through British Airways Club. ' : ''}Link both accounts on the Combine Avios page first (same name on each; a Finnair Plus account must be at least 30 days old), choose the direction, enter ${fmt(h.pointsIn)} and confirm. It is usually immediate and free between your own accounts. Check BA's page for today's rules.`,
            link: COMBINE,
          });
        });
      } else {
        steps.push({
          title: `In ${o.nameOf(h.from)}, transfer ${fmt(h.pointsIn)} points to ${o.nameOf(h.to)}`,
          note: `${how(h)} Log in to ${o.nameOf(h.from)} and look for its transfer (or "combine points") option. Both accounts must carry the same name.`,
        });
      }
      steps.push({
        title: `Wait until the points show in ${o.nameOf(h.to)}`,
        note: `Log in to ${o.nameOf(h.to)} and check the balance before you go on.${i === best.hops.length - 1 ? ` You need ${fmt(need)} there.` : ''}`,
      });
    });
  } else if (x?.status === 'pooled' && x.pooled) {
    x.pooled.transfers.forEach(t => {
      steps.push({
        title: `Transfer ${fmt(t.sourcePoints)} ${t.cardName} points to ${o.programme}`,
        note: 'Ratio and transfer time are on the checks page. You need an account with the airline programme first, in the same name as your card.',
        link: PORTAL[o.bankOf(t.cardId) ?? ''],
      });
    });
    steps.push({ title: `Wait until the points show in ${o.programme}`, note: `Log in to ${o.programme} and check you have ${fmt(need)} before you go on.` });
  } else {
    steps.push({ title: `Get ${fmt(need)} points into ${o.programme}`, note: 'Transfer them from your bank, then check the balance before you book. See Wallet for which cards can reach it.' });
  }
  steps.push(book);
  return { steps, direct: false };
}
