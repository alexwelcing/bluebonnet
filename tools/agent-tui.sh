#!/usr/bin/env bash
set -euo pipefail

ATTACH=1
if [[ "${1:-}" == "--no-attach" ]]; then
  ATTACH=0
  shift
fi

SESSION="${1:-bluebonnet}"
ROOT="${BLUEBONNET_ROOT:-/workspaces/bluebonnet}"
BRIDGE_LOG="${BRIDGE_LOG:-/tmp/bluebonnet-bridge.log}"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  if [[ "$ATTACH" == 1 ]]; then
    exec tmux attach-session -t "$SESSION"
  fi
  printf 'tmux session already running: %s\n' "$SESSION"
  exit 0
fi

tmux new-session -d -s "$SESSION" -c "$ROOT" -n command
tmux send-keys -t "$SESSION:command.0" "clear; printf 'BLUEBONNET command deck\n\n'; tail -n 50 .bridge/status.md" C-m
tmux split-window -h -t "$SESSION:command" -c "$ROOT"
tmux send-keys -t "$SESSION:command.1" "watch -n 2 'printf \"git status\\n\"; git status --short; printf \"\\nlatest status\\n\"; tail -n 18 .bridge/status.md'" C-m
tmux select-layout -t "$SESSION:command" even-horizontal

tmux new-window -t "$SESSION" -c "$ROOT" -n agents
tmux send-keys -t "$SESSION:agents.0" "clear; printf 'Codex agent pane\nRun when ready: codex\n\n'" C-m
tmux split-window -h -t "$SESSION:agents" -c "$ROOT"
tmux send-keys -t "$SESSION:agents.1" "clear; printf 'Claude agent pane\nRun when ready: claude\n\n'" C-m
tmux split-window -v -t "$SESSION:agents.1" -c "$ROOT"
tmux send-keys -t "$SESSION:agents.2" "clear; printf 'Spare model / shell pane\n\n'" C-m
tmux select-layout -t "$SESSION:agents" main-vertical

tmux new-window -t "$SESSION" -c "$ROOT" -n serve
tmux send-keys -t "$SESSION:serve.0" "npm run dev" C-m
tmux split-window -h -t "$SESSION:serve" -c "$ROOT"
tmux send-keys -t "$SESSION:serve.1" "python3 -m http.server 8123 --directory .bridge > '$BRIDGE_LOG' 2>&1" C-m
tmux select-layout -t "$SESSION:serve" even-horizontal

tmux new-window -t "$SESSION" -c "$ROOT" -n quality
tmux send-keys -t "$SESSION:quality.0" "clear; printf 'Quality gates\nnpm run typecheck\nnpm test\nnpm run lint:shotlist\nnpm run build\n\n'" C-m
tmux split-window -h -t "$SESSION:quality" -c "$ROOT"
tmux send-keys -t "$SESSION:quality.1" "clear; printf 'Deploy / preview pane\nRefresh preview: rm -rf .bridge/preview/* && cp -R dist/* .bridge/preview/\nDeploy: netlify deploy --prod --dir dist\n\n'" C-m
tmux select-layout -t "$SESSION:quality" even-horizontal

tmux new-window -t "$SESSION" -c "$ROOT" -n bridge
tmux send-keys -t "$SESSION:bridge.0" "tail -f .bridge/status.md" C-m
tmux split-window -h -t "$SESSION:bridge" -c "$ROOT"
tmux send-keys -t "$SESSION:bridge.1" "tail -f .bridge/decisions.md" C-m
tmux split-window -v -t "$SESSION:bridge.1" -c "$ROOT"
tmux send-keys -t "$SESSION:bridge.2" "tail -f '$BRIDGE_LOG'" C-m
tmux select-layout -t "$SESSION:bridge" main-vertical

tmux set-option -t "$SESSION" status on >/dev/null
tmux set-option -t "$SESSION" status-left "#[bold] $SESSION " >/dev/null
tmux set-option -t "$SESSION" mouse on >/dev/null
tmux select-window -t "$SESSION:command"

if [[ "$ATTACH" == 1 ]]; then
  exec tmux attach-session -t "$SESSION"
fi

printf 'tmux session started: %s\nAttach with: tmux attach -t %s\n' "$SESSION" "$SESSION"
