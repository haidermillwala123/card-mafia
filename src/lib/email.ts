// Alert emails through Resend. Server only. With no key set, nothing is sent and the caller is told so.
const RESEND = 'https://api.resend.com/emails';

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ALERT_FROM?.trim());

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<'sent' | 'not-configured' | 'failed'> {
  if (!emailConfigured()) return 'not-configured';
  try {
    const res = await fetch(RESEND, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.ALERT_FROM!.trim(), to: [to], subject, html, text }),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function seatAlertEmail(opts: { siteUrl: string; origin: string; dest: string; count: number; points: number; date: string; programme: string; seenHoursAgo: number }) {
  const { origin, dest, count, points, date, programme, seenHoursAgo, siteUrl } = opts;
  const route = `${origin} → ${dest}`;
  const subject = `Seats opened on ${route}`;
  const line = `${count} seat${count === 1 ? '' : 's'} on ${route}. Cheapest: ${points.toLocaleString('en-IN')} points on ${date} with ${programme}. Seen about ${seenHoursAgo} h ago.`;
  const text = `${line}\n\nSeats can disappear before you transfer. Check the seat, then the transfer rules, before you move any points.\n${siteUrl}/alerts\n\nCard Mafia does not book flights.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2 style="margin:0 0 8px">${esc(subject)}</h2><p>${esc(line)}</p><p><a href="${esc(siteUrl)}/alerts">Open your alerts</a></p><p style="color:#666;font-size:13px">Seats can disappear before you transfer. Card Mafia does not book flights.</p></div>`;
  return { subject, html, text };
}
