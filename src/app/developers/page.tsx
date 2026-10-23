import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import CopyButton from '@/components/CopyButton';
import JsonLd from '@/components/JsonLd';
import { MCP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Connect Card Mafia to Claude and ChatGPT',
  description: 'Add Card Mafia to Claude or ChatGPT as a connector or a Claude Desktop extension. 23 read-only tools for planning award flights with Indian cards.',
  alternates: { canonical: '/developers' },
};

const URL_MCP = MCP_URL;

const TOOLS: [string, string][] = [
  ['card_mafia_catalog', 'Exact ids for Indian premium cards, banks, programmes, airports and regions. The tools below use these, so it goes first.'],
  ['parse_trip_text', 'Turns one sentence about a trip, cards and balances into a structured trip. Uses Gemini, then checks it with rules.'],
  ['plan_trip', 'Builds up to three award plans, direct and multi-hop, with the pre-transfer safety check on each.'],
  ['explain_plan', 'Explains those plans in plain words. Uses Gemini, and falls back to rules text if it is off or slow.'],
  ['search_award_seats', 'Finds cached award seats between airports or regions and shows which ones your cards can pay for.'],
  ['calculate_points', 'The points calculator: card points to miles, miles to card points, and a pool of several cards.'],
  ['best_earning_card', 'Ranks cards by the points a month of spending earns, using each card\'s earn rules, caps and exclusions.'],
  ['categorize_merchants', 'Sorts card statement merchants into spend categories. Uses Gemini. Send merchant names only.'],
  ['seat_booking_handoff', 'The airline programme\'s own booking page for a seat, prefilled where possible, and the details to copy.'],
  ['buy_points_info', 'Whether a programme sells points, at what price, and the source of that price.'],
  ['data_status', 'Today\'s live seat-lookup budget, so you can tell how fresh the seat data is.'],
  ['trip_ideas', 'The cheapest business seat your cards can pay for in each region, from your home airport.'],
  ['wallet_overview', 'What the points in each of your cards reach: the best programmes, the miles they become, caps and transfer times.'],
  ['recommend_card', 'Which card to add for a month of spending: the top picks, a companion card and a stretch card, in comparable long-haul miles.'],
  ['analyze_statement', 'Reads a pasted statement or a PDF, finds a typical month of spending and ranks the cards that would earn the most. Nothing is stored.'],
  ['transfer_rules', 'The transfer explorer: every partner of a card with ratio, cap, time and limits, indirect routes that beat a direct transfer, or which cards reach a programme.'],
  ['card_earn_rules', 'The earn browser: base rates, accelerated categories, caps, milestones and exclusions for each card.'],
  ['compare_seats', 'Two or three seats side by side, with which of your cards can pay for each.'],
  ['recheck_seat', 'A live re-check of one seat right before you transfer.'],
  ['booking_steps', 'The ordered steps for a seat: transfer, wait, transfer, wait, book.'],
  ['pricing_plans', 'What is free, what the ₹99 day pass adds, and what Pro will be.'],
  ['learn_glossary', 'Points in plain English: ratio, multi-hop, caps and the other terms.'],
  ['about_card_mafia', 'What Card Mafia does and does not do, how old its rules are, and which features live on the website only.'],
];

const FAQ = [
  { q: 'Does the connector book flights or move my points?', a: 'No. Every tool only reads and calculates. Card Mafia never books a seat, transfers points, stores your cards, or asks for a bank or airline login or an OTP.' },
  { q: 'Do I need an account or an API key?', a: 'No. The connector has no sign-in. You tell your assistant which cards you hold and your balances in the conversation, and nothing is saved on our side.' },
  { q: 'Which AI writes the explanations?', a: 'Gemini reads your sentence, explains plans and sorts merchants. It never sets a number: ratios, caps and seats come from fixed rules, and a rules-written answer is used when Gemini is unavailable.' },
  { q: 'How current are the seats?', a: 'Seat data is cached and every result says how old it is. Check with your bank and the airline before you transfer, because seats can disappear.' },
];

export default function Developers() {
  return (
    <>
      <Breadcrumbs trail={[{ name: 'Connect', href: '/developers' }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      <div className="container stack" style={{ ['--stack' as string]: '32px', paddingBottom: 'var(--space-2xl)' }}>
        <h1 className="t-h1">Use Card Mafia from Claude and ChatGPT</h1>
        <p className="t-lg muted measure">Ask your assistant where you want to fly and which cards you hold. It plans the points path, searches award seats, reads your statement and runs the calculator through {TOOLS.length} read-only tools. Nothing is booked, transferred or stored. Saved wallet, saved trips, alerts and Gmail import need an account, so they stay on the website.</p>

        <section className="stack" aria-labelledby="url-h">
          <h2 id="url-h" className="t-h2">Connector address</h2>
          <p className="measure">This one address works in Claude, ChatGPT and any other app that supports remote MCP connectors. It needs no sign-in.</p>
          <div className="dev-url">
            <code>{URL_MCP}</code>
            <CopyButton value={URL_MCP} label="Copy address" />
          </div>
        </section>

        <section className="stack" aria-labelledby="add-h">
          <h2 id="add-h" className="t-h2">Add it</h2>
          <div className="tiers">
            <div className="tier" aria-label="Claude">
              <div className="top"><b className="t-title">Claude</b><span className="tag tag-best">Two ways</span></div>
              <p className="t-sm" style={{ marginTop: 12 }}><b>Install the extension (Claude Desktop):</b></p>
              <ol className="stack t-sm" style={{ ['--stack' as string]: '6px', marginTop: 6, paddingLeft: 18 }}>
                <li>Download the file below.</li>
                <li>Open it, or drag it into Claude Desktop under Settings, Extensions.</li>
                <li>Choose Install, then ask Claude to plan a trip.</li>
              </ol>
              <div className="btn-row" style={{ marginTop: 12 }}><a className="btn btn-primary" href="/downloads/card-mafia.mcpb" download>Download for Claude</a></div>
              <p className="t-sm" style={{ marginTop: 16 }}><b>Or add it as a connector:</b> Settings, Connectors, Add custom connector, name Card Mafia, paste the address above.</p>
            </div>
            <div className="tier" aria-label="ChatGPT">
              <div className="top"><b className="t-title">ChatGPT</b><span className="tag tag-sand">Developer mode</span></div>
              <ol className="stack t-sm" style={{ ['--stack' as string]: '6px', marginTop: 12, paddingLeft: 18 }}>
                <li>Open Settings, Connectors, Advanced, and turn on Developer mode.</li>
                <li>Choose Create, name it Card Mafia and paste the address above.</li>
                <li>Set authentication to none, save, then pick Card Mafia from the tools menu in a chat.</li>
              </ol>
              <p className="t-sm muted" style={{ marginTop: 12 }}>Custom connectors depend on your ChatGPT plan and workspace settings. If you do not see Developer mode, your plan or admin has it off.</p>
            </div>
            <div className="tier" aria-label="Claude Code and Codex">
              <div className="top"><b className="t-title">Claude Code and Codex</b><span className="tag">Terminal</span></div>
              <p className="t-sm" style={{ marginTop: 12 }}><b>Claude Code plugin</b> (the tools plus nine skills):</p>
              <pre className="dev-pre">{`/plugin marketplace add haidermillwala123/card-mafia\n/plugin install card-mafia@card-mafia`}</pre>
              <p className="t-sm" style={{ marginTop: 12 }}><b>Claude Code</b>, tools only:</p>
              <pre className="dev-pre">{`claude mcp add --transport http card-mafia ${URL_MCP}`}</pre>
              <p className="t-sm" style={{ marginTop: 12 }}><b>Codex</b>, in <code>~/.codex/config.toml</code>:</p>
              <pre className="dev-pre">{`[mcp_servers.card-mafia]\nurl = "${URL_MCP}"`}</pre>
            </div>
          </div>
        </section>

        <section className="stack" aria-labelledby="tools-h">
          <h2 id="tools-h" className="t-h2">The {TOOLS.length} tools</h2>
          <p className="measure">Each feature of the app is its own tool, so your assistant picks the one a question needs.</p>
          <dl className="dev-tools">
            {TOOLS.map(([name, text]) => (
              <div key={name}><dt><code>{name}</code></dt><dd>{text}</dd></div>
            ))}
          </dl>
        </section>

        <section className="stack" aria-labelledby="try-h">
          <h2 id="try-h" className="t-h2">Try asking</h2>
          <ul className="stack t-body measure" style={{ ['--stack' as string]: '8px' }}>
            <li>“I have an Axis Atlas with 3 lakh points. What can I fly to Europe in November?”</li>
            <li>“Plan Doha to Chicago in October 2027 for two, with an HDFC Infinia and 1.2 lakh points.”</li>
            <li>“I spend 15,000 a month on dining and 30,000 online. Which card earns the most?”</li>
          </ul>
        </section>

        <section className="faq" aria-labelledby="faq-h">
          <h2 id="faq-h" className="t-h2" style={{ marginBottom: 'var(--space-md)' }}>Questions</h2>
          {FAQ.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>

        <p className="t-sm muted measure">Not financial advice. Read <Link href="/about">how Card Mafia works</Link> and the <Link href="/privacy">privacy page</Link>, and see <Link href="/pricing">pricing</Link> for the day pass.</p>
      </div>
    </>
  );
}
