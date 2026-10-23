---
name: pick-best-card
description: Work out which credit card earns the most points or airline miles for how someone spends, or which card to add. Use for "best card for dining and online spend" or "should I get another card".
---

# Pick the best card

1. Get the monthly spend by category in rupees: general, travel_portal, international, dining, groceries, online, utilities, insurance, fuel, rent, education, other. Ask for the big ones if missing. Or use `read-my-statement` to get it from a statement.
2. For a plain ranking by points, call `best_earning_card`.
3. For "which card should I add" given the cards already held, call `recommend_card` with the spend, `heldCardIds`, optional `airlineProgrammeIds` and `annualFeeCapInr`. It returns top picks, a companion card and a stretch card the fee limit left out.
4. For one card's full rules, call `card_earn_rules` with its id.

Explain why a card wins: the category rates, caps and exclusions. State that figures are derived from published earn rules and the annual fee is shown separately. This is not financial advice.
