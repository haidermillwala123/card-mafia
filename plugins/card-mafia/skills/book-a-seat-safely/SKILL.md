---
name: book-a-seat-safely
description: Take a chosen award seat to the point of booking: re-check it, show the ordered transfer steps, where to book and what to copy, and where to buy points if short. Use right before someone transfers points.
---

# Book a seat safely

Card Mafia never books or transfers. It gets the person ready.

1. `recheck_seat` with the seat id, to refresh it live and see whether it is gone. If it is gone, stop and say so.
2. `booking_steps` for the ordered steps: bank transfer, wait, any further transfer, wait, book. Pass `airlineProgrammeBalance` if points are already in the airline programme.
3. `seat_booking_handoff` for the airline's own booking page (prefilled where possible) and the details to copy.
4. If the person is short on points, `buy_points_info` for whether and at what price the programme sells them.

Say clearly that transfers cannot be undone. Remind them to check the ratio, cap and name on the bank and airline sites first.
