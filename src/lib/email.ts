// Emails for sign-in codes and alerts. Server only. Gmail (an app password) wins when set, because it can email anyone with no
// domain; otherwise Resend, whose demo sender only reaches the account owner. With neither set, nothing is sent and the caller is told so.
import nodemailer from 'nodemailer';

const RESEND = 'https://api.resend.com/emails';
const gmail = () => {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  return user && pass ? { user, pass } : null;
};

export const emailConfigured = () => Boolean(gmail() || (process.env.RESEND_API_KEY?.trim() && process.env.ALERT_FROM?.trim()));

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<'sent' | 'not-configured' | 'failed'> {
  if (!emailConfigured()) return 'not-configured';
  const g = gmail();
  if (g) {
    try {
      const mail = nodemailer.createTransport({ service: 'gmail', auth: g });
      await mail.sendMail({ from: `Card Mafia <${g.user}>`, to, subject, html, text });
      return 'sent';
    } catch {
      return 'failed';
    }
  }
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

const F = `font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`;
// Shared dark shell for the sign-in and welcome emails.
const shell = (preheader: string, inner: string, foot: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head><body style="margin:0;background:#110F0E">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#110F0E;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 20px;${F};font-size:20px;font-weight:700;letter-spacing:-.02em;color:#EDEBE6">Card Mafia</td></tr>
<tr><td style="background:#221F1C;border:1px solid #3A3631;border-radius:20px;padding:32px 28px;${F}">${inner}</td></tr>
<tr><td style="padding:18px 4px 0;${F};font-size:12px;line-height:1.5;color:#8A8479">${foot}</td></tr>
</table></td></tr></table></body></html>`;

const NOT_AFFILIATED = 'Card Mafia plans points transfers. It does not book flights and is not affiliated with any bank or airline.';

export function codeEmail(code: string) {
  const subject = `${code} is your Card Mafia code`;
  const text = `Your Card Mafia sign-in code is ${code}. It works once and expires in 10 minutes.\n\nDid not ask for this? Ignore this email. Card Mafia never asks for bank logins, card numbers or bank OTPs.\n\n${NOT_AFFILIATED}`;
  const inner = `<h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#EDEBE6">Your sign-in code</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#AAA498">Type this code into Card Mafia. It works once and expires in 10 minutes.</p>
<div style="background:#110F0E;border:1px solid #3A3631;border-radius:14px;padding:20px 12px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:36px;font-weight:700;line-height:1;letter-spacing:.34em;color:#E6E9ED">${esc(code)}</div>
<p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:#AAA498">Did not ask for this? Ignore this email and nobody gets in. We never ask for this code by phone or chat, and never ask for bank logins, card numbers or bank OTPs.</p>`;
  return { subject, html: shell(`Your Card Mafia code is ${code}. It expires in 10 minutes.`, inner, NOT_AFFILIATED), text };
}

export function welcomeEmail(firstName: string, siteUrl: string) {
  const name = firstName.trim().slice(0, 60);
  const subject = 'Welcome to Card Mafia';
  const hi = name ? `Hi ${name}, thanks for joining.` : 'Thanks for joining.';
  const steps = ['Search award seats from India in Flights.', 'See which of your cards can pay for a seat, and the transfer path.', 'Run the safety check before you move any points.', 'Set an alert and get an email when seats open.'];
  const text = `${hi}\n\nHere is what you can do:\n${steps.map(s => `- ${s}`).join('\n')}\n\nOpen Card Mafia: ${siteUrl}/home\n\n${NOT_AFFILIATED}`;
  const li = (s: string, i: number) => `<tr><td style="width:28px;vertical-align:top;padding:6px 0;${F};font-size:13px;font-weight:700;color:#CDD1D6">${i + 1}</td><td style="padding:6px 0;${F};font-size:15px;line-height:1.5;color:#EDEBE6">${esc(s)}</td></tr>`;
  const inner = `<h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#EDEBE6">${esc(hi)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#AAA498">Your account is ready. Here is what you can do with it.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${steps.map(li).join('')}</table>
<a href="${esc(siteUrl)}/home" style="display:block;text-align:center;background:#CDD1D6;color:#110F0E;text-decoration:none;font-size:15px;font-weight:650;padding:14px 18px;border-radius:12px">Open Card Mafia</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#AAA498">Seats can disappear before you transfer, so check the seat and the transfer rules before you move points.</p>`;
  return { subject, html: shell('Your account is ready. Here is what you can do.', inner, NOT_AFFILIATED), text };
}
