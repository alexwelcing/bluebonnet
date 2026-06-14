# BLUEBONNET Team Operations Guide

This repo is run as a coordinated multi-agent production room. Hermes is the
orchestrator; specialist models are brought in when their harness or reasoning
profile fits the work.

## Team Roster

| Agent | Best Use | Primary Harness | Notes |
| --- | --- | --- | --- |
| Hermes | Orchestration, browser use, production loop, deploy/playtest coordination | Nous subscription plan + browser use | Owns routing, status logs, final integration, and live-site verification. |
| Codex | Repo edits, TypeScript/Vite implementation, tests, code review, git hygiene | Native Codex harness or Hermes | Best default for precise code changes and local verification. |
| Claude | Long-form architecture, writing, continuity, critique, UX/content passes | Native Claude harness or Hermes | Strong for canon-sensitive writing, design critique, and broad implementation review. |
| Kimi | Long-context reading, second-opinion reasoning, spec/backlog digestion | Native Kimi harness or Hermes | Use for large file/context audits and alternative implementation plans. |
| Minimax | Media/generation-adjacent critique, broad creative alternatives, auxiliary reasoning | Hermes only | Call through Hermes; do not assume direct repo access. |
| GLM / Z.ai | Fast alternate reasoning, implementation sanity checks, edge-case review | Hermes only | Call through Hermes; do not assume direct repo access. |

## Command Structure

Kimi swarm is the current strategic captain per Alex's 2026-06-13 directive.
Hermes is the XO / build integrator: it operates tmux, translates Kimi's
direction into one-writer slices, collects outputs, reconciles implementation
risks, and performs final repo edits or handoff. No delegated agent is considered
authoritative until Kimi's direction is integrated by Hermes against
`GAME_DIRECTION.md`, `AGENTS.md`, and the current repo state.

Codex is the default builder when the task is concrete code, tests, tooling, or
git work. Claude is the default partner for canon, narrative, UX feel, and
large-scope critique. Kimi is the default long-context auditor. Minimax and GLM
are reserve models available only through Hermes for additional perspectives.

## Routing Rules

Use one agent when the task is small, local, and verifiable. Use multiple agents
when work can split cleanly, when creative direction and code both matter, or
when the blast radius justifies independent review.

- **Implementation:** Codex owns the patch; Claude or Kimi reviews when scope is
  broad or user-facing.
- **Canon/content:** Claude drafts or critiques; Hermes checks against
  `GAME_DIRECTION.md`; Codex implements if code/content files change.
- **Long-context audit:** Kimi reads large manifests, transcripts, and backlog
  state; Hermes turns findings into actionable tasks.
- **Browser/live QA:** Hermes owns browser-use playtests and deployed-site checks.
- **Media/generation:** Hermes coordinates generation tools and may ask Minimax
  for creative alternatives or GLM for a sanity check.
- **Tie-breaks:** Canon beats model preference. `GAME_DIRECTION.md` >
  `SUPERVISOR.md` > `.bridge/backlog.md` > any agent suggestion.

## Operating Loop

1. Read the latest context: `GAME_DIRECTION.md`, `SUPERVISOR.md`,
   `.bridge/backlog.md`, and the tail of `.bridge/status.md`.
2. Pick one concrete objective. If it is parallelizable, assign specific
   questions to specialist agents instead of asking everyone to solve everything.
3. Integrate in the repo through one owner, usually Codex or Hermes.
4. Run the relevant gates. For gameplay changes, prefer `npm run gate -- --preview`;
   it runs `npm run typecheck`, `npm test`, `npm run lint:shotlist`, `npm run build`,
   then refreshes `.bridge/preview/` from the green `dist/` artifact.
5. Run `npm run doctor` when picking up a stale room or before generation spend;
   it prints tool availability, content density, shotlist/motion status, and secret
   presence by name only.
6. For deployable milestones, Hermes deploys and self-playtests the live site.
7. Append `.bridge/status.md`: what changed, what is next, blockers.
8. Record durable process or architecture decisions in `.bridge/decisions.md`.
9. Commit small verified changes on `main`.

## Tmux Room

Start the room from an interactive terminal:

```sh
tools/agent-tui.sh
```

The launcher opens:

- `command`: current status and git state.
- `agents`: Codex, Claude, and spare model/shell panes.
- `serve`: Vite dev server plus `.bridge` server on port 8123.
- `quality`: gate and deploy command scratch space (`npm run gate -- --preview`).
- `bridge`: live status, decisions, and bridge-server logs.

Use tmux as the practical TUI control plane in Codespaces/headless sessions.
Kitty is installed for graphical environments, but it is not the coordination
primitive.

For a model-maximized Hermes swarm, use the dedicated launcher:

```sh
tools/hermes-swarm.sh --probe --prefix bb --task "<one concrete objective>"
tmux attach -t bb-control
```

It creates separate Hermes tmux sessions for OpenAI Codex/GPT-5.5, Grok 4.3,
MiniMax-M3, GLM 5.1, and Gemini 2.5 Pro. The launch doctrine stays the same:
Hermes-XO is the only writer-lock candidate, while Grok/MiniMax/GLM/Gemini are
artifact-only sidecars under `.bridge/director/`. See `tools/HERMES_SWARM.md`.

## Handoff Format

When Hermes delegates work to another agent, keep the prompt narrow:

```text
Context:
- Repo: /workspaces/bluebonnet
- Canon: GAME_DIRECTION.md controls.
- Current objective: <one sentence>

Task:
- <specific ask>

Return:
- Findings or patch plan.
- File paths and line references where relevant.
- Risks, missing tests, and any assumptions.
```

Ask for analysis from reviewers, not unbounded rewrites. The integrating agent
owns the final patch and must verify it locally.

## Review Expectations

Every material change needs one of these:

- A test proving behavior.
- A browser/playtest transcript proving the workflow.
- A clear note explaining why a test was not useful.

Reviewers lead with concrete defects: file, line, symptom, and likely fix.
Creative review must still be tied to canon or player experience. "Feels off" is
not enough; say what breaks the found-footage fiction, puzzle fairness, or VHS
interface grammar.

## Model-Specific Playbook

### Hermes

- Owns orchestration, browser use, live deploy checks, bridge logs, and final
  coordination.
- Uses Minimax and GLM when extra perspectives are useful.
- Never prints secret values. Env var names are fine; values are not.

### Codex

- Best for code edits, tests, local tooling, refactors, and commits.
- Should read existing patterns before changing architecture.
- Should keep patches small and verification explicit.

### Claude

- Best for canon-sensitive writing, UX critique, narrative consistency, and
  large design passes.
- Should produce concrete deltas and identify where they map into repo files.

### Kimi

- Best for reading large accumulated context and finding contradictions.
- Should summarize with citations to files/sections and propose prioritized
  fixes.

### Minimax

- Accessed through Hermes only.
- Use for alternate creative/media directions, atmosphere critique, and broader
  ideation before committing to generation spend.

### GLM / Z.ai

- Accessed through Hermes only.
- Use for fast independent reasoning, edge-case checks, and "what are we
  missing?" reviews.

## Conflict Resolution

If agents disagree, Hermes reduces the disagreement to testable claims:

- Does canon require one answer?
- Does the existing architecture prefer one answer?
- Can a test, screenshot, or playthrough decide?
- Which option preserves the found-object fiction with the least machinery?

If the answer affects future sessions, record it in `.bridge/decisions.md`.

## Hard Rules

- Do not leak secrets. Never print `.env` values.
- Do not let generated imagery carry readable story text.
- Do not bypass puzzle fairness: every solution must be learnable in-world.
- Do not ship without green gates appropriate to the change.
- Do not leave the bridge stale after a green build.
- Do not treat delegated output as final until it is integrated and verified.
