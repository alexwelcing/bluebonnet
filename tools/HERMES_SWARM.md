# BLUEBONNET Hermes Swarm Launcher

`tools/hermes-swarm.sh` spawns multiple model-specific Hermes tmux shells for parallel BLUEBONNET work while preserving one-writer discipline.

## Quick start

```sh
# Probe all configured providers, then launch the swarm.
tools/hermes-swarm.sh --probe --prefix bb --task "B7 Act II density tranche planning: return artifacts only; no game-file edits."

# Attach to the dashboard.
tmux attach -t bb-control

# Stop all spawned shells.
tmux list-sessions | awk -F: '/^bb-/ {print $1}' | xargs -r -n1 tmux kill-session -t
```

Dry-run first if changing lanes:

```sh
tools/hermes-swarm.sh --dry-run --prefix bb-test --task "Smoke test launch plan."
```

## Default lane map

| tmux session | Provider/model | Lane | Allowed output |
| --- | --- | --- | --- |
| `bb-control` | shell | dashboard | no agent work; shows tmux/git/status |
| `bb-hermes-xo` | `openai-codex / gpt-5.5` | XO, integrator, only writer-lock candidate | repo edits only after explicit objective; gates + preview + bridge logs |
| `bb-grok-visual` | `xai-oauth / grok-4.3` | visual prompt/candidate sidecar | `.bridge/director/grok_*.md` prompt plans, curation criteria, failure modes |
| `bb-minimax-creative` | `minimax / MiniMax-M3` | atmosphere, copy, UX, Side B/performed-interaction taste | `.bridge/director/minimax_*.md` specs and critique |
| `bb-glm-qa` | `zai / glm-5.1` | guardrails, risk, tests, edge cases | `.bridge/director/glm_*.md` audit/gate proposals; additive tests only if explicitly assigned |
| `bb-gemini-critic` | `gemini / gemini-2.5-pro` | independent critic, playtest planner, long-context sanity | `.bridge/director/gemini_*.md` critique/playtest plans |

## Strategic operating pattern

1. Kimi/captain direction remains upstream when available; Hermes-XO integrates.
2. Pick one production objective, not a vague “everyone improve the game” prompt.
3. Give every sidecar a different artifact, not the same problem:
   - Grok: visual prompt pack + A1 rejection taxonomy.
   - MiniMax: player-feel/copy/interaction spec.
   - GLM: risks, missing tests, automated gates.
   - Gemini: critic route/playtest plan or cross-act continuity review.
   - Hermes-XO: integrate only after reading artifacts and granting itself/the selected writer one lock.
4. Sidecars do not edit game code/content/assets/tests by default. They write only `.bridge/director/*.md` artifacts when assigned.
5. Hermes-XO integrates one slice, runs `npm run gate -- --preview`, then `npm run playtest:smoke` or a route-specific browser script for gameplay changes.
6. Append `.bridge/status.md`; record durable process/canon changes in `.bridge/decisions.md`.

## Provider smoke results from this Codespace

Verified on 2026-06-13:

```text
openai-codex / gpt-5.5       READY-CODEX
minimax / MiniMax-M3         READY-MINIMAX
zai / glm-5.1                READY-GLM
xai-oauth / grok-4.3         READY-GROK
gemini / gemini-2.5-pro      READY-GEMINI
```

The API-key `xai` provider failed in this Codespace; use `xai-oauth` for Grok.

## Example assignments

### B7 density tranche

```text
GROK-VISUAL: Write .bridge/director/grok_act2_density_prompt_pack.md. Produce 8 concrete A7 multi-reference clean-plate prompts for Act II lateral/detail views. No shorthand. Include hard negatives and expected failure modes. End with GROK-ACT2-DENSITY-DONE.

MINIMAX-CREATIVE: Write .bridge/director/minimax_act2_player_feel.md. Review Act II field mapping experience: how lateral/detail nodes should support orientation, dread, and puzzle fairness. MUST/SHOULD/COULD. End with MINIMAX-ACT2-FEEL-DONE.

GLM-QA: Write .bridge/director/glm_act2_density_gates.md. Propose tests/lints that catch stranded routes, clue regressions, A1 prompt drift, motion-loop missing media, and brittle count assertions. End with GLM-ACT2-GATES-DONE.

GEMINI-CRITIC: Write .bridge/director/gemini_act2_playtest_route.md. Design a critic playtest route and transcript schema for the new Act II density tranche. End with GEMINI-ACT2-CRITIC-DONE.
```

Hermes-XO then integrates one small slice, not all sidecar ideas at once.

## Why this is safer than “max agents all editing”

The launcher puts all available models to work on distinct lanes while keeping the repo safe:

- parallel model cognition, serial file integration;
- one writer lock;
- parseable done tokens;
- artifacts under `.bridge/director/`;
- verification owned by Hermes-XO;
- no sidecar deploys, commits, or secret exposure.
