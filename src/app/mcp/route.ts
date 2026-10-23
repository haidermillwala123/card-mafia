// Card Mafia as a remote MCP server (Streamable HTTP), so Claude, ChatGPT and any other MCP client can use it as a connector.
// Connector URL: https://<your-domain>/mcp . No sign-in: every tool is read-only and works from what the caller types in.
// Stateless: each request gets its own server, so it runs the same on any serverless instance.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { allow } from '@/lib/claude';
import { clientKey } from '@/lib/guard';
import { registerTools } from '@/lib/mcp/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const INSTRUCTIONS = [
  'Card Mafia plans award flights for Indian premium credit cards: which card to use, which transfer path is cheapest, and which seat to book.',
  'Call card_mafia_catalog first to get exact card, programme and airport ids. Then plan_trip or search_award_seats, and calculate_points for conversions.',
  'Every number comes from a rules engine with a stated check date and every seat shows its age. Card Mafia never books, transfers or stores anything: tell the person to confirm on the bank and airline sites before moving points.',
].join(' ');

// The tools are public, read-only and carry no cookies, so any origin may call them (browser-based MCP inspectors need this).
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-expose-headers': 'mcp-session-id',
};

const withCors = (res: Response) => {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
};

async function handle(req: Request) {
  // someone pasted the connector address into a browser: show the page that explains it
  if (req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/html')) return Response.redirect(new URL('/developers', req.url), 302);
  // its own counter: the app's limiter keeps one count per key, and the routes behind each tool count the bare address
  if (!allow(`mcp:${clientKey(req)}`, 120)) return withCors(Response.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests. Wait a minute and try again.' }, id: null }, { status: 429 }));
  const server = new McpServer({ name: 'card-mafia', title: 'Card Mafia', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  registerTools(server, req);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return withCors(await transport.handleRequest(req));
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
