# Card Mafia as an MCP connector and Claude plugin

Card Mafia runs as a remote MCP server (Streamable HTTP) inside the same Next.js app. 23 tools, one per feature that does not need a personal login. Every tool is read-only: nothing is booked, transferred or saved.

**Connector address:** `https://cards-mafia.vercel.app/mcp`. No sign-in. (`card-mafia.vercel.app/mcp` also works.)

## Connect it

- **Claude plugin (Claude Code):** the tools plus nine skills.
  ```
  /plugin marketplace add haidermillwala123/card-mafia
  /plugin install card-mafia@card-mafia
  ```
- **Claude Desktop extension:** download `https://cards-mafia.vercel.app/downloads/card-mafia.mcpb`, open it, choose Install.
- **Claude (claude.ai or Desktop) as a connector:** Settings, Connectors, Add custom connector, name `Card Mafia`, paste the address.
- **ChatGPT:** Settings, Connectors, Advanced, turn on Developer mode, Create. Name `Card Mafia`, paste the address, authentication none. Availability depends on plan and workspace settings.
- **Claude Code, tools only:** `claude mcp add --transport http card-mafia https://cards-mafia.vercel.app/mcp`
- **Codex:** in `~/.codex/config.toml`:
  ```toml
  [mcp_servers.card-mafia]
  url = "https://cards-mafia.vercel.app/mcp"
  ```
- **Try it in a browser:** `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, same address.

## Tools and the app features they cover

| App feature | Tool | Uses Gemini |
| --- | --- | --- |
| Ids for cards, banks, programmes, airports, regions | `card_mafia_catalog` | no |
| Home: describe a trip in a sentence | `parse_trip_text` | yes |
| Plan | `plan_trip`, `explain_plan` | explain only |
| Flights search | `search_award_seats` | no |
| Compare seats | `compare_seats` | no |
| Checkout: re-check a seat | `recheck_seat` | no |
| Checkout: ordered steps | `booking_steps` | no |
| Hand-off: where to book | `seat_booking_handoff` | no |
| Buy points | `buy_points_info` | no |
| Trips you can take | `trip_ideas` | no |
| Wallet: what my points reach | `wallet_overview` | no |
| Calculator | `calculate_points` | no |
| Earn calculator | `best_earning_card` | no |
| Best card for you | `recommend_card` | no |
| Statement reader | `analyze_statement`, `categorize_merchants` | yes |
| Transfers and Rules | `transfer_rules` | no |
| Earn browser | `card_earn_rules` | no |
| Seat data freshness | `data_status` | no |
| Pricing | `pricing_plans` | no |
| Learn | `learn_glossary` | no |
| About | `about_card_mafia` | no |

Gemini (`google/gemini-3.7-flash` through OpenRouter, `OPENROUTER_API_KEY`) only writes language. Ratios, caps and seats come from the rules engine. With no key set, the Gemini tools fall back to rules. The `"via": "claude"` label in some results is an old name in the code: the model is Gemini.

## What is not in the connector

Saved wallet, saved trips, route and custom alerts, Gmail import, account and sign-in. They belong to a signed-in person and live on the website. In the connector the person types their cards and balances into the conversation, and `wallet_overview` and `trip_ideas` do the wallet's maths from that. Adding them would need OAuth sign-in between Claude or ChatGPT and Card Mafia.

## The Claude plugin

`.claude-plugin/marketplace.json` at the repo root lists one plugin, `plugins/card-mafia`. It carries `.mcp.json` (the connector) and nine skills in `skills/`: plan-award-trip, find-award-seats, what-can-my-points-buy, pick-best-card, read-my-statement, points-calculator, transfer-rules-explorer, book-a-seat-safely and learn-points. Each says which tools to call, in what order, and what to tell the person. Check it with `claude plugin validate .`.

## How it works

`src/app/mcp/route.ts` is the HTTP entry, stateless: each request builds its own server. `src/lib/mcp/tools.ts` and `tools-more.ts` register the tools. Most tools call the app's own route handlers in-process (`src/lib/mcp/call.ts`), so they share the website's validation, rate limits and daily caps. The address shown on the site is `MCP_URL` in `src/lib/site.ts`.

## Limits to know

- Rate limits count per caller address. A hosted connector reaches us from the provider's addresses, so many people on one provider share the same limits.
- A seat that was not looked up recently is fetched live and can take up to a minute. Regions in `search_award_seats` are capped to 12 airports, and each region in `trip_ideas` to 8.
- Seat data is cached and every row carries its age. Tell people to confirm on the bank and airline sites before moving points.
- `cards.mafia.vercel.app` cannot be used: Vercel reserves every `*.mafia.vercel.app` name for another account.

## Test locally

```
npm run build && npm start        # then, in another terminal:
npx @modelcontextprotocol/inspector
```

The dev server on `npm run dev` also serves `/mcp`.
