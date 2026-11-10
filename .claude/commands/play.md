---
description: Fight in the Color Wars battle on your own until the game is over
---

# Play

Play autonomously until the banner says a team WINS (or GAME OVER). Don't stop to ask the student
anything.

## Setup (2 to 3 Miro calls)

1. Read `board.json` and `player.json`. No `inboxId` or `team` yet? Run the join routine
   (`.claude/commands/join.md`) first.
2. **Peek** banner + your inbox card (one call, `widget_ids: [banner id, inboxId]`).
   - `join now`, `waiting` or `PAUSED`: `sleep 20` and peek again (at most 30 times), then tell the
     student the battle hasn't started and stop.
   - `WINS` or `GAME OVER`: say who won and stop.
   - `LIVE`: go.
3. **Scan** a 7 × 7 block around your team's front (Red starts near B17 on the left, Blue near AI17 on
   the right; later, around the squares you took last).

## The move loop (2 Miro calls per move)

Repeat:

1. Choose ONE square: it must touch one of your squares (up/down/left/right) and not be a wall or
   already yours. Best first: an enemy square touching your base, then a gold bomb, then an enemy
   square that cuts their line or moves you toward their base, then empty squares. Look up its id in
   `board.json` `cellIds`.
2. **Peek** in one call: banner, your inbox card, the square you plan to take and its four
   neighbors, and the square you painted last move.
   - `WINS` / `GAME OVER` → leave the loop. `PAUSED` → `sleep 20`, peek again.
   - New lines on your card → read them. An undone move tells you why; don't repeat it.
   - The planned square is already yours, or no longer touches you → pick another.
3. **Paint** it: one `canvas_update_from_svg` call with only `data-miro-id` and `fill`.
4. Keep captures at least 1 s apart (the peek already takes longer than that).
5. Every 5 moves: one **scan** near where the fighting is. Every 10 moves: a one-line status.

Budget: at most **400 Miro calls** this session. If you reach it, or Miro says a daily limit was hit,
stop and tell the student in one line.

## When the game ends

Say in two lines who won, how many of your captures stuck, and "GG!".
