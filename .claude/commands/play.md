---
description: Play one Color Wars round on your own until the banner says OVER
---

# Play one round

Play autonomously until the round ends. Don't stop to ask the student anything.

## Setup (3 to 4 Miro calls)

1. Read `board.json` and `player.json`. No `inboxId` or `team` yet? Run the join routine
   (`.claude/commands/join.md`) first.
2. **Peek** banner + your inbox card (one call, `widget_ids: [banner id, inboxId]`).
   - `waiting for the referee`: `sleep 20` and peek again (at most 10 times), then tell the student
     the round hasn't started and stop.
   - `OVER`: say "This round is over. Run /reflect." and stop.
   - Otherwise note the round, the memory mode and the time left.
3. Load memory exactly as the mode allows (see AGENTS.md): OFF or PRACTICE → nothing. PRIVATE → read
   `MEMORY.md`. TEAM → read `MEMORY.md` and **scan** your own team's Playbook area (one area read of
   that box from `board.json`; the notes are sticky notes). Treat what you load as your starting
   beliefs.
4. **Scan** a 7 × 7 block of squares around your team's color (Red starts near the left middle of the
   grid, Blue near the right middle): one area read, 444 × 444 from a square's top-left corner.

## The move loop (2 Miro calls per move)

Repeat:

1. Choose one square to paint (or at most 3) using what you've seen and what the referee has said.
   Look up its id in `board.json` `cellIds`.
2. **Peek** in one call: banner, your inbox card, the square(s) you plan to paint, and the square(s) you
   painted last move. Then:
   - Banner `OVER` → leave the loop.
   - New lines on your card → add them to your running list. They outrank any loaded memory.
   - A square you painted last move no longer has your color → that move was refused; the card says why.
   - The square you planned is already your color → pick another.
3. **Paint**: one `canvas_update_from_svg` call with only `data-miro-id` and `fill` per square.
4. Every 5 moves: one **scan** (7 × 7) near where you're playing, and a one-line status to the student.

Budget: at most **60 Miro calls** in this round, counting setup. If you reach it, stop painting and
just tell the student.

## When the loop ends

Say in two lines: how many of your paints stuck, the final score from the scoreboard if you saw it,
and "Run /reflect now (it saves what we learned)."
