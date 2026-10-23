---
name: what-can-my-points-buy
description: Show what the points in a person's cards can buy. Use for "what can I fly with my points", "what is my balance worth" or "where could I go with Axis Atlas and Infinia".
---

# What can my points buy

1. Collect the cards and balances. Get ids from `card_mafia_catalog` (kind `cards`).
2. Call `wallet_overview` for what each card reaches: the best programmes, the miles they become, caps and transfer time.
3. Call `trip_ideas` with the home airport and the same cards and balances for the cheapest business seat the cards can pay for in each region. It can take up to a minute, so say you are checking.
4. Lead with the best idea, then the rest by points needed. Give the card that pays for each and the seat's age.

If the person has no cards yet, use the `pick-best-card` skill instead. Saved wallets need a Card Mafia account on the website; here the person types their balances in.
