// Runs one of the app's own JSON route handlers in-process, so an MCP tool and the website go through the same validation, rate limits
// and daily caps. Nothing is re-implemented here. The caller's address headers are passed on, so limits count the real caller.
type Handler = (req: Request) => Promise<Response>;

const FORWARD = ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for'];
const MAX_TEXT = 40_000;

export type ToolOut = { content: { type: 'text'; text: string }[]; isError?: boolean };

export const text = (value: unknown, isError = false): ToolOut => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const body = raw.length > MAX_TEXT ? `${raw.slice(0, MAX_TEXT)}\n[cut: ask for fewer rows or a narrower request]` : raw;
  return { content: [{ type: 'text', text: body }], ...(isError ? { isError: true } : {}) };
};

// The caller's address headers, so the route behind a tool rate-limits the real caller.
export function forwardHeaders(from: Request): Headers {
  const headers = new Headers();
  for (const h of FORWARD) {
    const v = from.headers.get(h);
    if (v) headers.set(h, v);
  }
  return headers;
}

// POST `body` to a route handler, or GET when `body` is undefined.
export async function callRoute(handler: Handler, body: unknown, from: Request): Promise<ToolOut> {
  const headers = forwardHeaders(from);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const req = new Request('http://card-mafia.internal/api', { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const res = await handler(req);
    const json = await res.json().catch(() => ({ error: `The service answered ${res.status} with no readable body.` }));
    return text(json, !res.ok);
  } catch (e) {
    console.error('mcp tool failed', e instanceof Error ? e.message : e);
    return text({ error: 'The tool could not finish. Nothing was changed. Try again.' }, true);
  }
}
