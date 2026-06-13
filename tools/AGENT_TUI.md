# BLUEBONNET Agent TUI

Use `tools/agent-tui.sh` to open the coordinated tmux deck:

```sh
tools/agent-tui.sh
```

It creates:

- `command`: status tail plus live `git status`
- `agents`: ready panes for `codex`, `claude`, and a spare model/shell
- `serve`: `npm run dev` and the `.bridge` server on port 8123
- `quality`: prompts for typecheck, tests, shotlist lint, build, preview refresh, and deploy
- `bridge`: live tails for status, decisions, and bridge server logs

For automation or smoke tests:

```sh
tools/agent-tui.sh --no-attach bluebonnet-smoke
tmux attach -t bluebonnet-smoke
```

`kitty` is installed as the GUI terminal emulator. In Codespaces/headless shells,
use tmux as the practical TUI control plane; launch kitty only from an environment
with a graphical display.
