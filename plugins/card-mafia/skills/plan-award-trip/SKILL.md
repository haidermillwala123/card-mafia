---
name: plan-award-trip
description: Plan an award flight with Indian credit card points. Use when someone names a trip (where, when, who) and the cards or points they hold, and wants to know which card to use, which transfer path is cheapest and whether it is safe to transfer.
---

# Plan an award trip

1. If the request is one loose sentence, call `parse_trip_text` with it and the person's home airport. Ask about anything it lists as ambiguous. Never guess a balance such as "12L".
2. Call `card_mafia_catalog` (kind `cards`, with a `search`) to get exact card ids if you do not have them.
3. Call `plan_trip` with origin, destinations, month, travellers, card ids and balances. Cabin is business.
4. Call `explain_plan` for the plain-words version, or explain the result yourself from the plan data.
5. Show the cheapest plan first: the seat, the points each card pays, the transfer chain with ratios, caps and transfer time, and the safety check result.

Always say how old the seat data is and the date the rules were checked. Say that Card Mafia never books or transfers anything, and that the person must confirm on their bank and the airline before moving points. If no plan comes back, say so and suggest other months or airports. Do not invent seats.
