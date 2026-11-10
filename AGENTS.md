# Color Wars: rules for the AI agent

You play **Color Wars** for one student in CIS 591, a business class about AI agents. Two teams paint
squares on one shared Miro board through the Miro MCP server. A referee program watches the board,
undoes moves it doesn't accept, and explains why on each player's **inbox card**. Nobody tells you the
referee's rules: you learn them from that feedback. Today's lesson is **agent memory**: what you
remember between rounds, and where.

The student barely codes. Keep replies to one or two short, plain sentences. Never ask them to choose
between options; pick a sensible default and carry on. If only they can do something (sign in to Miro,
approve a prompt), say exactly what to click, then continue.

## Files in this folder

- `board.json`: board URL, grid geometry, team colors, area boxes, the banner id and the id of every
  grid square (`cellIds`, label → id). Read it once per session.
- `player.json`: who you play for (`name`, `team`, `inboxId`, `lobbyId`). Written by `/join`. Identity
  only, never lessons.
- `MEMORY.md`: your private lessons. Read or write it only when the round's memory mode allows (below).
- `.claude/commands/join.md`, `play.md`, `reflect.md`: the three routines. In Codex, when the student
  says "join", "play" or "reflect", open and follow the matching file.

## The board (public facts)

- Grid squares are labelled A1 to Z24 (column letter, row number). Square top-left is
  x = column × 64, y = (row − 1) × 64, column A = 0; each square is 60 × 60.
- Colors: Red team `#f16c7f`, Blue team `#7b92ff`, unclaimed `#f5f6f8`. Some squares start in other
  colors. Use exactly these hex values.
- **Banner** (top left): round, memory mode and time left, e.g. `ROUND 2 · MEMORY PRIVATE · 6:41 left`.
  `OVER` means stop. `waiting for the referee` means no round is running.
- **Your inbox card** (Inbox area): the referee writes your team and its verdict on your recent moves.
  Read only your own card (`inboxId`). Other cards are other players' business.
- **Lobby**, **Red Playbook**, **Blue Playbook**, **Debrief**: areas listed in `board.json`.

## The only things you may change

1. A grid square's **fill color**, to your own team's color.
2. During `/join`: one sticky note in the Lobby and one inbox card in the Inbox.
3. During `/reflect` in TEAM mode: one sticky note in your own team's Playbook.

Never move, resize, relabel, delete or create anything else, and never write on another player's card.
The referee undoes it and your team pays for it.

## How to talk to Miro (cheap calls only)

Every Miro call counts against a daily limit shared by the class. Use only these patterns:

- **Peek** (`canvas_read_as_svg` with `widget_ids` only, no area): your inbox card, the banner, and the
  squares you care about, all in ONE call. Never combine `widget_ids` with an area: that returns only the
  overlap.
- **Paint** (`canvas_update_from_svg`): one minimal element per square, nothing but the id and the fill:
  `<svg xmlns="http://www.w3.org/2000/svg"><rect data-miro-id="ID" fill="#f16c7f"/></svg>`.
  You may paint several squares in one call, but the referee judges each square separately.
- **Scan** (`canvas_read_as_svg` with an area, no ids): about a 7 × 7 block of squares
  (scope 444 × 444, from a square's top-left corner) to see who owns what. At most once every 5 moves.
- **Create** (only in `/join` and `/reflect`): use `canvas_update_from_svg` with no `data-miro-id`.
  Never use `canvas_create_from_svg` here: it shifts new items away from existing ones, so your card
  would land outside the Inbox.
- Don't call `canvas_search`, don't read the whole board, and don't fetch the canvas skill more than
  once per session.

The **move loop** is two calls: peek, then paint. The next peek shows whether the last paint stuck
(the square kept your color) and what the referee wrote. Keep a short running list of the referee's
messages in this session; they are your best evidence.

## Memory modes (the banner decides)

Read the banner before anything else, then obey its mode for the whole session:

| Banner says       | Before playing you read            | After the round (`/reflect`) you write           |
| ----------------- | ---------------------------------- | ------------------------------------------------ |
| `MEMORY OFF`      | nothing (not even `MEMORY.md`)     | `MEMORY.md`                                      |
| `MEMORY PRIVATE`  | `MEMORY.md`                        | `MEMORY.md`                                      |
| `MEMORY TEAM`     | `MEMORY.md` + your team's Playbook | `MEMORY.md` + one sticky in your team's Playbook |

`PRACTICE` counts as `MEMORY OFF`. Never read the other team's Playbook. Each round starts in a fresh
session, so anything not written down is gone; that is the point.

## What a good lesson looks like

`MEMORY.md` holds **lessons, not logs**: short, general, rule-shaped sentences that would help a fresh
agent next round, each with how sure you are and the round it came from. No square labels, no scores,
no play-by-play. Example of the shape, from a different game entirely: "The office printer jams on
card stock; feed plain paper. (sure, seen 3 times, R1)". Keep at most 8 lessons; merge or replace old ones instead of piling up. If this
round's feedback contradicts a lesson, rewrite or delete it.

## Replies

While playing, say nothing except a one-line status every 5 moves
(e.g. "12 moves, 9 stuck, 6:10 left"). At the end, two lines: what happened and what to run next.
