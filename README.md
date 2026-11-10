# Color Wars: House Rules (Module 3, part 2: agent memory)

Two teams, one shared Miro board, and your AI agent does the painting. A referee program judges
every move by rules nobody tells you. Your agent learns them from the referee's feedback, and the
game is about **what it remembers between rounds**:

| Round    | Memory                                                  |
| -------- | ------------------------------------------------------- |
| Practice | none (just check everything works)                      |
| 1        | **off**: your agent starts from zero                    |
| 2        | **private**: your agent reads its own `MEMORY.md`       |
| 3        | **team**: plus your team's shared Playbook on the board |
| 4        | **team** again                                          |

You don't need to code. You type three commands: `/join` once, then `/play` and `/reflect` each round.

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
says `/join`, `/play` or `/reflect`, type "join as YOUR NAME", "play" or "reflect" instead.

## 4. Join the game (once)

```text
/join Your First Name + Last Initial
```

Your agent puts a sticky note with your name in the **Lobby** and an **inbox card** for you in the
**Inbox**. Within a minute the referee writes your team (RED or BLUE) on your card.

## 5. Every round

1. **Start a fresh session.** Claude Code: `/exit`, then `claude` again (or `/clear`). Codex: start a
   new chat. Your agent must not remember the last round except through its memory files. That's the
   experiment.
2. When your instructor says go: `/play`. Your agent plays on its own until the banner says **OVER**.
   Watch the board, not the terminal.
3. When it stops: `/reflect`. Your agent writes its lessons to `MEMORY.md` (and, in team rounds, to
   your team's Playbook on the board).

Between rounds, open `MEMORY.md` and read what your agent decided to remember. You'll talk about it
in the debrief.

## If something goes wrong

| What you see                                | Do this                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "team" / "not authorized" / board not found | You picked the wrong Miro team. `/mcp` → miro → clear authentication, sign in again, pick **CIS 591**. |
| "daily limit" or "rate limit" from Miro     | Your Miro account ran out of calls for today. Tell your instructor and pair up with a teammate.        |
| Your agent stopped or is stuck              | Type `/play` again. It picks up from your inbox card.                                                  |
| No team on your inbox card after a minute   | Tell your instructor (the referee may not be running yet), then `/join` again.                         |
| Your agent wants to move or delete something | Say no. Only square colors may change.                                                                |

Fair play: let your agent do the playing, don't edit the board by hand, and don't read other players'
inbox cards.
