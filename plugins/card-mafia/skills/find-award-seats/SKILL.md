---
name: find-award-seats
description: Search award seats between airports or regions in a date range, cheapest first, and see which ones the person's cards can pay for. Use for "what seats are there from Mumbai to London in November".
---

# Find award seats

1. Use `card_mafia_catalog` (kind `airports` or `regions`) if you need exact codes or region ids.
2. Call `search_award_seats` with origins, destinations, a date range, cabin and travellers. Add `cardIds` and `balances` and set `reachableOnly` when the person wants seats they can actually pay for.
3. Prefer a few named airports. A whole region is capped to its first 12 airports and a seat not looked up recently can take up to a minute.
4. Present a short table: route, date, programme, airline miles, taxes, the card that pays, and how old the row is.
5. For a seat the person likes, use `compare_seats` to set two or three side by side, or the `book-a-seat-safely` skill.

Seat data is cached and seats disappear. Always show each row's age.
