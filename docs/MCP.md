# Card Mafia as an MCP connector

Card Mafia runs as a remote MCP server (Streamable HTTP) inside the same Next.js app. One tool per feature. Every tool is read-only: nothing is booked, transferred or saved.

**Connector URL:** `https://<your-domain>/mcp` (production: `https://card-mafia.vercel.app/mcp`). No sign-in.

## Connect it

- **Claude (claude.ai or Desktop):** Settings, Connectors, Add custom connector. Name `Card Mafia`, URL as above.
- **ChatGPT:** Settings, Connectors, Advanced, turn on Developer mode, Create. Name `Card Mafia`, URL as above, authentication none.
- **Claude Code:** `claude mcp add --transport http card-mafia https://<your-domain>/mcp`
- **Codex:** add to `~/.codex/config.toml`:
  ```toml
  [mcp_servers.card-mafia]
  url = "https://<your-domain>/mcp"
  ```
- **Try it in a browser:** `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, same URL.

## Tools

| Tool | What it does | Uses Gemini |
| --- | --- | --- |
| `card_mafia_catalog` | Exact ids for cards, banks, programmes, airports, regions. Call this first. | no |
| `parse_trip_text` | One sentence into a structured trip, cards and balances. | yes |
| `plan_trip` | Up to three award plans with the pre-transfer safety check. | no |
| `explain_plan` | The plans explained in plain words. Falls back to rules text. | yes |
| `search_award_seats` | Cached award seats, with which ones the cards can pay for. | no |
| `calculate_points` | Forward, reverse and pooled points calculator. | no |
| `best_earning_card` | Ranks cards by points on a month of spending. | no |
| `categorize_merchants` | Sorts statement merchants into spend categories. | yes |
| `seat_booking_handoff` | The airline's booking page and the details to copy. | no |
| `buy_points_info` | Whether and where a programme sells points, with price and source. | no |
| `data_status` | Today's live seat-lookup budget. | no |

Gemini (`google/gemini-3.7-flash` through OpenRouter, `OPENROUTER_API_KEY`) only writes language. Ratios, caps and seats come from the rules engine. With no key set, the Gemini tools fall back to rules. The `"via": "claude"` label in some results is an old name in the code: the model is Gemini.

## How it works

`src/app/mcp/route.ts` is the HTTP entry, stateless: each request builds its own server. `src/lib/mcp/tools.ts` registers the tools. Most tools call the app's own route handlers in-process (`src/lib/mcp/call.ts`), so they share the website's validation, rate limits and daily caps.

## Limits to know

- Rate limits count per caller address. A hosted connector reaches us from the provider's addresses, so many people on one provider share the same limits.
- A seat that was not looked up recently is fetched live and can take up to a minute. Regions in `search_award_seats` are capped to 12 airports.
- Seat data is cached and every row carries its age. Tell people to confirm on the bank and airline sites before moving points.

## Test locally

```
npm run build && npm start        # then, in another terminal:
npx @modelcontextprotocol/inspector
```

The dev server on `npm run dev` also serves `/mcp`.
