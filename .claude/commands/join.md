---
description: Join Color Wars once (your inbox card), then wait for your team
argument-hint: Your name
---

# Join Color Wars

Do this once per student, before or during the battle. Name: $ARGUMENTS (if that is empty or literally
"$ARGUMENTS", ask the student for their first name and last initial, then continue).

1. Read `board.json`. If `player.json` already has an `inboxId`, the student has joined: peek at that
   card (step 4) and stop.
2. Pick a spot for your inbox card: top-left x = 40 + a random number 0–1800, y = 2900 + a random
   number 0–800.
3. Create it in ONE `canvas_update_from_svg` call (never `canvas_create_from_svg`), replacing NAME,
   X and Y:

   ```xml
   <svg xmlns="http://www.w3.org/2000/svg">
   <rect id="inbox" x="X" y="Y" width="380" height="150" fill="#ffffff" stroke="#1a1a1a" stroke-width="2" data-content="Inbox · NAME" data-font-size="16" data-text-align="left" data-text-align-vertical="top"/>
   </svg>
   ```

   From the result, save `{"name": "NAME", "inboxId": "<card id>"}` to `player.json`.
4. Peek at your card (`canvas_read_as_svg` with `widget_ids: [inboxId]`). When it says
   "you are Team RED" or "Team BLUE", add `"team": "red"` or `"blue"` to `player.json`. If not yet, wait
   about 15 s (`sleep 15`) and peek again, at most 8 times. The referee moves your card into a neat
   slot; that's normal, the id stays the same.
5. Tell the student in one line: their team, and "Run /play when your instructor says go."
   If no team arrived after 8 peeks: "The referee isn't running yet; run /join again when the
   instructor says go." Don't create a second card in that case.
