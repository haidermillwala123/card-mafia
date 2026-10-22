# Card Mafia persona panel, 22 Oct 2026

Eight personas tested the running app (rendered HTML plus the `/api/*` routes, no shared browser). Counts show how many of the 8 hit each gap. Static audits only: nobody used a real screen reader or a real phone.

## What people are thinking

- "Honest and well built, but it is a Doha-to-US demo." (family, Infinia whale, sceptic, student, first-timer, NRI all said some version of this.)
- They trust the sources, the "Nothing is locked" line, the Axis Qatar warning, and the labelled sample seats.
- Nobody would pay for Pro today. Six of eight would pay for rule-change alerts plus a seat re-check once live seats exist. Nobody would pay for the calculator or transfer explorer, and they want those free.
- The calculator and `/transfers` are the parts people would bookmark.

## Ranked gaps

| # | Gap | Hit by | Fix in this build |
|---|-----|--------|-------------------|
| 1 | Only Doha to JFK/ORD/LAX/MIA, Oct 2027. Europe, Japan, Singapore, Bangkok, anything non-US is a dead end ("No cached seats…") | 8 | `/flights` with every airport, charted award prices, deep links |
| 2 | `/api/parse` guesses silently: origin forced to DEL, destination dropped, cabin forced to business, travellers 1, wrong card ("Amex Gold", "Chase Sapphire Reserve"), all points put on one card, "6k" and "1,20,000" not read | 7 | Ask instead of guess; show what was read and what is missing |
| 3 | Generic API errors ("Check the numbers and try again") with no field named; calc `pool` and `reverse` payloads undiscoverable | 6 | Field-level messages |
| 4 | Parse rate limit (429) hits on the 2nd or 3rd call | 5 | Raise the limit for parse, keep it per client |
| 5 | Marketing runs ahead of data: "Verified award plans", "Saves 0 points" next to "Half the points. Same seat.", "Seat verified 21 Oct 2026" / "checked 3 h ago", a BOM→JFK 12 Dec 2026 sample pass | 5 | Reword claims; fix the landing counter and its sample; label the sample |
| 6 | No About, Privacy, Terms, Contact, or how-it-earns page | 3 (sceptic, NRI, family) | Add a plain About and Privacy page (needs the user's real facts) |
| 7 | Jargon unexplained: Qsuite, hop, cap, chain, ratio "1.6:1", Saver/Advantage/Access | 4 | Award seat types guide, plain-language labels |
| 8 | Beginners get no answer to "what can 40,000 points buy" | 3 | Goals and wallet planner; shortfall in plain words |
| 9 | Not for US cardholders or non-Indian origins; no statement of that up front | 2 | Say India-card-first on landing and `/plan`; US origins work in `/flights` for charted awards |
| 10 | Child and infant award rules, mixed cabins, split bookings, flexible date window, one-way vs return | 2 | Not built. Listed for the user |
| 11 | Mobile weight: about 5 MB of JS per page, `/rules` is a 1.3 MB HTML page (dev mode inflates JS) | 1 | Remove the Status and Source columns, which also shrinks `/rules` |
| 12 | Accessibility: landing has no skip link, partial focus styles, theme toggle has no `aria-pressed`; tables lack `scope` and captions; `/account` has no server-rendered h1 | 1 | Fix |
| 13 | Rule rows all say "Unverified"; one third-party source (points.casa) | 4 | Status and source columns removed per the user's request; the source is still disclosed on About |

## Not added yet (from the personas' own words)

- Live seat availability (needs a seats.aero key and a commercial-use agreement before charging for it).
- Rule-change alerts, saved plans on every device, pre-transfer seat re-check: Pro extras are described but not built.
- Hinglish input.
- Value per point in rupees, devaluation history, sweet-spot guidance (Virgin to ANA, Flying Blue promos).
- A beginner "what to do first" path (bank portal, link a frequent-flyer account).
- A past-date warning on the trip month.

## Method limits

- Personas are model-played. They show likely confusion, not measured demand.
- The server ran in Next dev mode, so page-weight numbers overstate production.
- Nobody tested the emailed sign-in code, which needs a real inbox and the `{{ .Token }}` template.
