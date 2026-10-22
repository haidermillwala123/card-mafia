// Shared gate for the JSON API routes: same-origin browsers only, JSON only, small bodies only.
// Browsers always send Origin on cross-site POSTs, so a mismatch means another site is driving the request.

const MAX_BODY = 8 * 1024;

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser callers (curl, server code) send no Origin; they carry no ambient cookies
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Returns the parsed JSON body, or a Response to send back when the request must be refused.
export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const refuse = (status: number, error: string) => ({ ok: false as const, res: Response.json({ error }, { status }) });
  if (!sameOrigin(req)) return refuse(403, 'This request came from another site.');
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return refuse(415, 'Send JSON.');
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return refuse(413, 'That request is too large.');
  const text = await req.text().catch(() => '');
  if (text.length > MAX_BODY) return refuse(413, 'That request is too large.');
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return refuse(400, 'Send valid JSON.');
  }
}

// The address to rate-limit on. On Vercel the platform sets these headers itself; a client-typed X-Forwarded-For is not trusted first.
export const clientKey = (req: Request) =>
  req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'local';
