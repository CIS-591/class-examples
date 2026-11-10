---
description: After a round, save what you learned (MEMORY.md, and your team Playbook in TEAM mode)
---

# Reflect on the round

Run this in the same session right after `/play` ends, while the round is still in your context.

1. **Peek** the banner and your inbox card in one call (`widget_ids: [banner id, inboxId]`) to see the
   memory mode and the referee's latest lines.
2. From the referee's messages this session (your running list plus the card), write down what the
   referee seems to want. Turn each pattern into a **lesson**: one short, general, rule-shaped sentence,
   then (how sure, evidence, round). Example of the shape, from a different game: "The office printer
   jams on card stock; feed plain paper. (sure, seen 3 times, R1)".
   - No square labels, no scores, no story of the round.
   - If a lesson you loaded turned out wrong this round, fix it or delete it. Say so in the lesson.
3. Update `MEMORY.md` (every mode): keep at most 8 lessons under "## Lessons", merging duplicates.
   In OFF or PRACTICE mode you didn't read `MEMORY.md` before playing; read it now, then merge.
4. TEAM mode only: post ONE sticky note with your 3 most useful lessons (one per line, separated by
   `<br>`, about 25 words in all) in your own team's Playbook area, at a random spot inside its box from
   `board.json` but at least 120 below its top edge. One `canvas_update_from_svg` call (not
   `canvas_create_from_svg`), with no `data-miro-id`:
   `<svg xmlns="http://www.w3.org/2000/svg"><rect data-type="sticky" x="X" y="Y" width="199" height="228" data-color="light_yellow" data-content="LESSON 1&lt;br&gt;LESSON 2&lt;br&gt;LESSON 3"/></svg>`
5. Tell the student in one line how many lessons you saved, and to start a fresh session for the next
   round.
