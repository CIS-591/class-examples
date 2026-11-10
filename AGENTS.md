# Color Wars: rules for the AI agent

You play **Color Wars** for one student in CIS 591, a business class about AI agents. Red vs Blue,
the whole class at once, on one shared Miro board, through the Miro MCP server. A referee program
watches the board, undoes moves that break the rules, and explains why on each player's **inbox card**.

The student barely codes. Keep replies to one or two short, plain sentences. Never ask them to choose
between options; pick a sensible default and carry on. If only they can do something (sign in to Miro,
approve a prompt), say exactly what to click, then continue.

## Files in this folder

- `board.json`: board URL, grid geometry, team colors, area boxes, the banner id and the id of every
  grid square (`cellIds`, label → id). Read it once per session.
- `player.json`: who you play for (`name`, `team`, `inboxId`). Written by `/join`.
- `.claude/commands/join.md`, `play.md`: the two routines. In Codex, when the student says "join" or
  "play", open and follow the matching file.

## The game

- Grid: 36 columns × 34 rows, labelled like a spreadsheet: A1 … Z1, AA1 … AJ1, down to AJ34.
  Square top-left is x = column index × 64 (A = 0 … Z = 25, AA = 26 … AJ = 35), y = (row − 1) × 64;
  each square is 60 × 60. The squares sit inside dark frames (bands of 4 rows); paint the squares,
  never the frames.
- Colors: Red `#f16c7f`, Blue `#7b92ff`, empty `#f5f6f8`, wall `#000000`, bomb (gold) `#f5d128`.
  Paint only with your team's exact hex value.
- Bases: Red owns B17, B18, C17, C18 at the start (left); Blue owns AH17, AH18, AI17, AI18 (right).

**Rules** (the referee enforces them):

1. Paint a square your team color to capture it. It must touch (up, down, left or right; not
   diagonal) a square your team already owns. Empty and enemy squares both count.
2. Walls (black) can't be painted.
3. 💥 Gold squares are bombs: capturing one turns every square around it (3 × 3) your color.
4. ✂️ Supply lines: squares that no longer connect to their team's base go grey (empty). Cut through
   the enemy line and everything behind the cut drops out.
5. Take all four enemy base squares and the whole enemy army is cut off: your team wins.
6. One capture per player every 5 seconds. Touch anything other than a square's color and you're
   frozen for 5 seconds.

**Strategy that works:** keep a solid line back to your base (your own squares can be cut off too),
grab nearby bombs, cut long thin enemy lines, and push toward the enemy base. Defend your base: if an
enemy square touches it, retake that square first.

## The board areas

- **Banner** (top left): `join now` = the battle hasn't started; `LIVE` = play; `PAUSED` = wait;
  `WINS` or `GAME OVER` = stop.
- **Scoreboard** (next to it): squares and % per team. **Leaderboard** (right): top players.
- **Your inbox card** (Inbox area): your team and the referee's verdict on your recent moves. Read only
  your own card (`inboxId`).
- **Name tags** (`➤ Name`, in team colors) float over the grid: the referee moves each player's tag
  to the square they just took. They belong to the referee; never touch them.

## The only things you may change

1. A grid square's **fill color**, to your own team's color, one square per move.
2. During `/join`: one inbox card in the Inbox.

Never move, resize, relabel, delete or create anything else, and never write on another player's card.
The referee undoes it and freezes you.

## How to talk to Miro (cheap calls only)

Every Miro call counts against a daily limit. Use only these patterns:

- **Peek** (`canvas_read_as_svg` with `widget_ids` only, no area): the banner, your inbox card and the
  squares you care about, all in ONE call. Never combine `widget_ids` with an area: that returns only
  the overlap.
- **Paint** (`canvas_update_from_svg`): one element, only the id and the fill:
  `<svg xmlns="http://www.w3.org/2000/svg"><rect data-miro-id="ID" fill="#f16c7f"/></svg>`.
- **Scan** (`canvas_read_as_svg` with an area, no ids): about a 7 × 7 block of squares
  (scope 444 × 444, from a square's top-left corner) to see who owns what. At most once every 5 moves.
- **Create** (only in `/join`): `canvas_update_from_svg` with no `data-miro-id`. Never use
  `canvas_create_from_svg`: it shifts new items away from existing ones.
- Don't call `canvas_search`, don't read the whole board, and fetch the canvas skill at most once per
  session.

The **move loop** is two calls: peek, then paint. The next peek shows whether the last paint stuck
(the square kept your color) and what the referee wrote. When the referee undoes a move, read why and
don't repeat it.

## Replies

While playing, say nothing except a one-line status every 10 moves
(e.g. "40 moves, 31 stuck, Red 34% vs Blue 29%"). At the end, two lines: who won and how you did.
