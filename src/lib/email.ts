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
  const f = `font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`;
  const stat = (k: string, v: string) => `<td style="padding:12px 14px;background:#110F0E;border:1px solid #3A3631;border-radius:12px;${f}"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8A8479">${k}</div><div style="margin-top:4px;font-size:17px;font-weight:650;color:#EDEBE6">${esc(v)}</div></td>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head><body style="margin:0;background:#110F0E">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(line)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#110F0E;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 20px;${f};font-size:20px;font-weight:700;letter-spacing:-.02em;color:#EDEBE6">Card Mafia</td></tr>
<tr><td style="background:#221F1C;border:1px solid #3A3631;border-radius:20px;padding:32px 28px;${f}">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8A8479">Seat alert</div>
<h1 style="margin:6px 0 8px;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#EDEBE6">${esc(route)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#AAA498">${count} seat${count === 1 ? '' : 's'} showing now. Cheapest is on ${esc(date)} with ${esc(programme)}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin:0 -8px 20px"><tr>${stat('Points', points.toLocaleString('en-IN'))}${stat('Date', date)}</tr><tr>${stat('Programme', programme)}${stat('Seen', `about ${seenHoursAgo} h ago`)}</tr></table>
<a href="${esc(siteUrl)}/alerts" style="display:block;text-align:center;background:#CDD1D6;color:#110F0E;text-decoration:none;font-size:15px;font-weight:650;padding:14px 18px;border-radius:12px">See your options</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#AAA498">Seats can disappear before you transfer. Check the seat, then the transfer rules, before you move any points.</p>
</td></tr>
<tr><td style="padding:18px 4px 0;${f};font-size:12px;line-height:1.5;color:#8A8479">You get this because you set an alert in Card Mafia. Turn it off any time on the Alerts page. Card Mafia does not book flights and is not affiliated with any bank or airline.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
