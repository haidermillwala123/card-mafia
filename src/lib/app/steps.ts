// The ordered steps between "I picked a seat" and "I book it": every transfer hop from the card to the airline programme, a wait after
// each, then the booking. Built only from the seat's own transfer chain and the rules behind it (ratio, block size, transfer time).
// Nothing here is invented: a rule with no stated transfer time says "check the transfer time", never a guess.
import type { SeatView } from './api';

export type Step = { title: string; note?: string; link?: { label: string; href: string } };
export type Plan = { steps: Step[]; direct: boolean };

// Bank rewards sites where points are moved to partner programmes. Only banks whose address we are sure of; any other bank gets plain wording.
const PORTAL: Record<string, { label: string; href: string }> = {
  hdfc: { label: 'Open HDFC SmartBuy rewards', href: 'https://offers.smartbuy.hdfcbank.com/' },
  axis: { label: 'Open Axis EDGE Rewards', href: 'https://edgerewards.axisbank.com/' },
  amex: { label: 'Open Amex Membership Rewards', href: 'https://global.americanexpress.com/rewards' },
};
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
      if (i === 0) {
        steps.push({
          title: `Transfer ${fmt(h.pointsIn)} ${best.cardName} points to ${o.nameOf(h.to)}`,
          note: `${how(h)} You need an account with ${o.nameOf(h.to)} first, in the same name as your card.`,
          link: PORTAL[o.bankOf(best.cardId) ?? ''],
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
