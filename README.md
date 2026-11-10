# Color Wars: Red vs Blue (Module 3, part 2)

The whole class, one shared Miro board, two teams. Your AI agent does the fighting: it paints squares
your team's color, attacks the other team, sets off bombs and cuts supply lines, while a referee
program keeps everyone honest. Everyone plays at the same time.

**Rules** (also on the board): capture squares that touch your team; enemy squares count too.
💥 Gold squares are bombs. ✂️ Squares cut off from their base go grey. Take all four enemy base squares
and their whole army is cut off: **your team wins**.

You don't need to code. You type two commands: `/join` once, then `/play`.

## 1. Get the kit

```bash
git clone --branch module-3-part-2 https://github.com/CIS-591/class-examples.git color-wars
```

```bash
cd color-wars
```

## 2. Join the class Miro team

1. Open the invite link: **[INVITE LINK: your instructor posts it in Canvas]**
2. Sign in to Miro (or create a free account) with your ASU email and accept the invite to the
   **CIS 591** team.
3. Open the board: https://miro.com/app/board/uXjVEP4jFXM=/ . Keep it open on screen during the game.

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
