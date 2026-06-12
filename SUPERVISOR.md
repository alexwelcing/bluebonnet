# BLUEBONNET — Directive Inbox (read every autonomous cycle)
Authority order: GAME_DIRECTION.md (canon) > this file > backlog. Alex or the supervising agent drops directives here; the autonomous loop reads them at the top of each cycle and folds them into the backlog before working.

## Standing directives
- Self-playtest every deploy via BrowserUse against the live Netlify URL; a milestone is not "done" until the deployed build is verified by actually playing it (clicking hotspots, spinning the jog wheel, completing the puzzle, reading exhibit text). File any defect you find as a kanban card and fix before reporting done.
- Never let a deploy ship with AI-rendered diegetic text or a regressed puzzle chain. The whole-shotlist lint and the DOM-level puzzle tests are gates.
- Small verified commits; push with GIT_TERMINAL_PROMPT=0 and a 360s timeout.

## Open directives (newest first)
- (none — append below)
