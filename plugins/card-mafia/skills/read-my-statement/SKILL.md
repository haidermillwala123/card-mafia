---
name: read-my-statement
description: Read a credit card statement (pasted lines or a PDF) and turn it into a typical month of spending, then find the card that would earn the most. Use when the person shares or pastes a statement.
---

# Read my statement

1. Call `analyze_statement`. Send pasted transactions as `text` (date, merchant, amount per line). For a PDF send it as base64 in `pdfBase64` (up to 4 MB) and add `pdfPassword` if it is protected.
2. Report the period, how many transactions were read, the detected card, and the monthly spend by category.
3. Show the three best cards it ranked, with monthly points and any notes about caps or excluded spend.
4. Offer `recommend_card` with the same spend for a fuller recommendation.

Only merchant names are sent to Gemini to place unknown merchants, never amounts or dates. Nothing is stored. If the PDF is unreadable, ask for the transactions pasted instead.
