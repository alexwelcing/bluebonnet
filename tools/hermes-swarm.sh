#!/usr/bin/env bash
set -euo pipefail

ROOT="${BLUEBONNET_ROOT:-/workspaces/bluebonnet}"
PREFIX="${BLUEBONNET_SWARM_PREFIX:-bb}"
ATTACH=0
DRY_RUN=0
PROBE=0
TASK="${BLUEBONNET_SWARM_TASK:-Review the current BLUEBONNET state and wait for a specific producer assignment.}"

usage() {
  cat <<'USAGE'
Usage: tools/hermes-swarm.sh [options]

Spawn model-specific Hermes tmux shells for the BLUEBONNET production room.

Options:
  --prefix NAME      tmux session prefix (default: bb)
  --task TEXT        shared current objective included in every lane prompt
  --probe           run one-shot provider smoke checks before spawning
  --dry-run         print tmux/hermes commands without executing
  --attach          attach to the control session after launch
  -h, --help        show this help

Default sessions:
  <prefix>-control          shell dashboard, git/status/room map
  <prefix>-hermes-xo        OpenAI Codex gpt-5.5, integrator / only writer lock candidate
  <prefix>-grok-visual      xAI OAuth grok-4.3, visual/prompt candidate sidecar
  <prefix>-minimax-creative MiniMax-M3, mood/copy/UX sidecar
  <prefix>-glm-qa           GLM 5.1, risk/test/guardrail sidecar
  <prefix>-gemini-critic    Gemini 2.5 Pro, independent critic/playtest planner

Doctrine:
  Kimi/captain strategy remains upstream when present. Hermes-XO integrates.
  Only hermes-xo may become writer. All other lanes are artifact-only sidecars.
  Sidecars write only .bridge/director/*.md when explicitly tasked.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      PREFIX="${2:?--prefix requires a value}"
      shift 2
      ;;
    --task)
      TASK="${2:?--task requires a value}"
      shift 2
      ;;
    --probe)
      PROBE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --attach)
      ATTACH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

run() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '+ %q' "$1"
    shift || true
    for arg in "$@"; do printf ' %q' "$arg"; done
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '+ %s\n' "$*"
  else
    bash -lc "$*"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

probe_model() {
  local label="$1" provider="$2" model="$3" token="$4"
  printf 'Probe %-16s provider=%s model=%s ...\n' "$label" "$provider" "$model"
  hermes chat --provider "$provider" -m "$model" -q "Reply exactly ${token}." -Q --max-turns 1 >/tmp/bluebonnet-swarm-probe-${label}.log
  if grep -q "$token" /tmp/bluebonnet-swarm-probe-${label}.log; then
    printf '  ok: %s\n' "$token"
  else
    printf '  failed: expected %s; see /tmp/bluebonnet-swarm-probe-%s.log\n' "$token" "$label" >&2
    return 1
  fi
}

lane_prompt() {
  local role="$1"
  cat <<PROMPT
BLUEBONNET SWARM BOOT
Repo: /workspaces/bluebonnet
Command posture: Kimi/captain strategy is upstream when present; Hermes-XO integrates. You are the lane: ${role}.
Current objective: ${TASK}

Non-negotiable rules:
- Do not print secrets or .env values.
- Do not commit, deploy, push, or spawn more agents.
- Do not edit game code/content/assets/tests unless Hermes-XO explicitly grants writer lock. Default: writer lock CLOSED.
- If asked for an artifact, write only under .bridge/director/ with a model/lane-specific filename, then stop.
- Ground findings in files, line refs, screenshots/transcripts, or concrete repo commands.
- Respect GAME_DIRECTION.md, AGENTS.md, and A1/A6/A7/A9/A10 canon.

First action now: acknowledge your lane and wait. If you have tool access, you may read only the top-level docs needed to orient, but do not change files until assigned.
End your acknowledgement with: ${role}-READY
PROMPT
}

create_control() {
  local session="${PREFIX}-control"
  if tmux has-session -t "$session" 2>/dev/null; then
    printf 'tmux session already running: %s\n' "$session"
    return 0
  fi
  run tmux new-session -d -s "$session" -c "$ROOT" -n command
  run tmux send-keys -t "$session:command.0" "clear; printf 'BLUEBONNET Hermes swarm control\\n\\n'; printf 'Task: %s\\n\\n' \"$TASK\"; tmux list-sessions; printf '\\n--- git ---\\n'; git status --short; printf '\\n--- status tail ---\\n'; tail -n 30 .bridge/status.md" C-m
  run tmux split-window -h -t "$session:command" -c "$ROOT"
  run tmux send-keys -t "$session:command.1" "watch -n 5 'tmux list-sessions; printf \"\\n--- panes ---\\n\"; tmux list-panes -a -F \"#{session_name}|#{window_name}|#{pane_index}|#{pane_current_command}|#{pane_current_path}\"; printf \"\\n--- git ---\\n\"; git status --short | sed -n \"1,60p\"'" C-m
  run tmux select-layout -t "$session:command" even-horizontal
  run tmux set-option -t "$session" mouse on >/dev/null
}

create_lane() {
  local name="$1" provider="$2" model="$3" role="$4" toolsets="$5"
  local session="${PREFIX}-${name}"
  if tmux has-session -t "$session" 2>/dev/null; then
    printf 'tmux session already running: %s\n' "$session"
    return 0
  fi
  local cmd="hermes chat --provider ${provider} -m ${model} -t ${toolsets} --accept-hooks"
  run tmux new-session -d -s "$session" -x 160 -y 48 -c "$ROOT" "$cmd"
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '+ sleep 6 && tmux load-buffer/paste-buffer prompt into %q && tmux send-keys Enter\n' "$session"
  else
    sleep 6
    local buffer="${session}-boot-prompt"
    lane_prompt "$role" | tmux load-buffer -b "$buffer" -
    tmux paste-buffer -d -b "$buffer" -t "$session"
    tmux send-keys -t "$session" Enter
  fi
}

require_cmd tmux
require_cmd hermes

if [[ "$PROBE" == 1 && "$DRY_RUN" != 1 ]]; then
  probe_model minimax minimax MiniMax-M3 READY-MINIMAX
  probe_model glm zai glm-5.1 READY-GLM
  probe_model codex openai-codex gpt-5.5 READY-CODEX
  probe_model grok xai-oauth grok-4.3 READY-GROK
  probe_model gemini gemini gemini-2.5-pro READY-GEMINI
fi

create_control
create_lane hermes-xo openai-codex gpt-5.5 HERMES-XO "terminal,file,skills,session_search,todo,browser,vision"
create_lane grok-visual xai-oauth grok-4.3 GROK-VISUAL "terminal,file,skills,session_search,vision,image_gen"
create_lane minimax-creative minimax MiniMax-M3 MINIMAX-CREATIVE "terminal,file,skills,session_search,vision"
create_lane glm-qa zai glm-5.1 GLM-QA "terminal,file,skills,session_search"
create_lane gemini-critic gemini gemini-2.5-pro GEMINI-CRITIC "terminal,file,skills,session_search,vision"

printf '\nBLUEBONNET Hermes swarm ready. Sessions:\n'
tmux list-sessions 2>/dev/null | grep "^${PREFIX}-" || true
printf '\nControl: tmux attach -t %s-control\n' "$PREFIX"
printf 'Stop all spawned sessions: tmux list-sessions | awk -F: '\''/^%s-/ {print $1}'\'' | xargs -r -n1 tmux kill-session -t\n' "$PREFIX"

if [[ "$ATTACH" == 1 ]]; then
  exec tmux attach-session -t "${PREFIX}-control"
fi
