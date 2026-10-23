---
name: points-calculator
description: Convert between credit card points and airline miles. Use for "how many KrisFlyer miles do 1 lakh Atlas points become", "how many points for 60,000 miles" or "can my two cards together reach this seat".
---

# Points calculator

Call `calculate_points` in one of three modes:

- `forward`: N points on a card (`cardId`, `points`) become how many miles in each programme.
- `reverse`: a `target` programme and `miles` figure costs how many points on each card.
- `pool`: several cards' balances (`rows`) towards one `target` and `miles`, with the shortfall.

Set `direct` true for direct transfers only, false to include multi-hop routes that can cost less. Get card and programme ids from `card_mafia_catalog`. Report the ratio, any monthly or annual cap, and the transfer time. Mark rows that are not confirmed.
