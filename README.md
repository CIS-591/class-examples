# Color Wars: Red vs Blue (Module 3, part 2)

The whole class, one shared Miro board, two teams. Your AI agent does the fighting: it paints squares
your team's color, attacks the other team, sets off bombs and cuts supply lines, while a referee
program keeps everyone honest. Everyone plays at the same time.

**The board:** https://miro.com/app/board/uXjVEP4jFXM=/

**Rules** (also on the board): capture squares that touch your team; enemy squares count too.
💥 Gold squares are bombs. ✂️ Squares cut off from their base go grey. Take all four enemy base squares
and their whole army is cut off: **your team wins**.

You don't need to code. You type two commands: `/join` once, then `/play`.

## Quick start (one prompt, no restart)

First accept the Miro invite from your instructor (check your email) and open the board:
https://miro.com/app/board/uXjVEP4jFXM=/ . Then open Claude Code in any folder (`claude`) and paste:

```text
Set me up and play Color Wars. 1) Clone https://github.com/CIS-591/class-examples.git (branch module-3-part-2) into ~/color-wars (if it already exists, git pull there instead). 2) Install the Miro plugin: run `claude plugin install miro@claude-plugins-official`; if that fails, run `claude plugin marketplace add miroapp/miro-ai` and then `claude plugin install miro@miro-ai`. 3) Tell me, in two short lines, to type /reload-plugins, then /mcp, choose miro, Authenticate, and pick the Miro team that owns https://miro.com/app/board/uXjVEP4jFXM=/ (CIS 591), and to say "done" after. Wait for me. 4) Then read ~/color-wars/AGENTS.md and follow it for the rest of this session; board.json and player.json live in ~/color-wars. Follow ~/color-wars/.claude/commands/join.md (ask me my first name and last initial), then follow ~/color-wars/.claude/commands/play.md until the game is over.
```

You type only three things after pasting it: `/reload-plugins`, the `/mcp` sign-in, and "done". When
Claude asks to use a Miro tool, choose "Yes, and don't ask again". The steps below are the same thing
by hand.

## 1. Get the kit

```bash
git clone --branch module-3-part-2 https://github.com/CIS-591/class-examples.git color-wars
```

```bash
cd color-wars
```

## 2. Get into the Miro board

1. Your instructor invites you to the board by email. Accept it, signing in to Miro (or creating a
   free account) with your ASU email.
2. Open the board: https://miro.com/app/board/uXjVEP4jFXM=/ . Keep it open on screen during the game.
   You must be able to **edit** it (not just view or comment); if you can't, tell your instructor.

## 3. Connect your agent to Miro

### Claude Code

Start Claude Code inside the `color-wars` folder (`claude`), then type:

```text
/plugin marketplace add miroapp/miro-ai
/plugin install miro@miro-ai
```

Quit Claude Code (`/exit`) and start it again in the same folder. Type `/mcp`, pick **miro**, then
**Authenticate**. A browser window opens: log in to Miro and, when it asks for a team, pick the
**CIS 591** team (the one from the invite). Allow access.

If Claude Code asks whether to allow a Miro tool, choose "Yes, and don't ask again".

### Codex

Add these two lines to `~/.codex/config.toml` (create the file if it doesn't exist):

```toml
[mcp_servers.miro]
url = "https://mcp.miro.com/"
```

Then sign in (a browser opens; pick the **CIS 591** team):

```bash
codex mcp login miro
```

Start Codex inside the `color-wars` folder. Codex reads `AGENTS.md` automatically. Where this page
says `/join` or `/play`, type "join as YOUR NAME" or "play" instead.

## 4. Join the game (once)

```text
/join Your First Name + Last Initial
```

Your agent puts an **inbox card** with your name in the **Inbox** area of the board. Within a minute
the referee writes your team (RED or BLUE) on it.

## 5. Play

When your instructor says go:

```text
/play
```

Your agent fights on its own until a team wins. Watch the board, not the terminal: your name tag
(`➤ Your Name`) jumps to every square you take, and the leaderboard on the right ranks the top players.

## If something goes wrong

| What you see                                | Do this                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "team" / "not authorized" / board not found | You picked the wrong Miro team. `/mcp` → miro → clear authentication, sign in again, pick **CIS 591**. |
| "daily limit" or "rate limit" from Miro     | Your Miro account ran out of calls for today. Tell your instructor and pair up with a teammate.        |
| Your agent stopped or is stuck              | Type `/play` again. It picks up where it left off.                                                     |
| No team on your inbox card after a minute   | Tell your instructor (the referee may not be running yet), then `/join` again.                         |
| Your agent wants to move or delete something | Say no. Only square colors may change.                                                                |

Fair play: let your agent do the playing, don't edit the board by hand, and don't read other players'
inbox cards.
