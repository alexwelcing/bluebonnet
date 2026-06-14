#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/workspaces/bluebonnet}"
cd "$ROOT"

printf 'BLUEBONNET DIRECTOR LOOP SNAPSHOT\n'
printf 'timestamp: '
date -Iseconds
printf 'root: %s\n\n' "$ROOT"

printf '== git status ==\n'
git status --short || true
printf '\n== tmux sessions ==\n'
tmux list-sessions 2>/dev/null || true
printf '\n== tmux panes ==\n'
tmux list-panes -a -F '#{session_name}|#{window_name}|#{pane_index}|#{pane_current_command}|#{pane_current_path}' 2>/dev/null || true

printf '\n== sidecar tails ==\n'
for s in grok-4-3-imagine minimax-m3 glm-5-1 kimi-audit; do
  printf '\n---- %s ----\n' "$s"
  if tmux has-session -t "$s" 2>/dev/null; then
    tmux capture-pane -pt "$s:0.0" -S -60 2>/dev/null | tail -60 || true
  else
    printf 'missing\n'
  fi
done

printf '\n== director artifacts by mtime ==\n'
find .bridge/director -maxdepth 1 -type f -printf '%TY-%Tm-%Td %TH:%TM %p %s bytes\n' 2>/dev/null | sort | tail -20 || true

printf '\n== status tail ==\n'
tail -80 .bridge/status.md 2>/dev/null || true

printf '\n== active loop doctrine ==\n'
sed -n '1,220p' .bridge/director/loop_best_practices.md 2>/dev/null || true
