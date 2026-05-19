#!/usr/bin/env bash
# Claude Desktop の MCP 設定に talent-hr を追加するヘルパー（macOS）。
# - 既存ファイルがあればバックアップ
# - python が python -c で読める形で merge
# - .talent/config.json から TALENT_TOKEN を取得
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd -P)"
CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
TOKEN_FILE="$HOME/.talent/config.json"

if [ ! -f "$ROOT/.venv/bin/python" ]; then
  echo "✗ .venv が見つかりません。先に make install を実行してください。" >&2
  exit 1
fi
if [ ! -f "$TOKEN_FILE" ]; then
  echo "✗ ~/.talent/config.json が見つかりません。先に CLI で talent login を実行してください。" >&2
  exit 1
fi

PYTHON="$ROOT/.venv/bin/python"
TOKEN=$("$PYTHON" -c "import json,os;print(json.load(open(os.path.expanduser('~/.talent/config.json')))['token'])")

mkdir -p "$(dirname "$CONFIG")"
if [ -f "$CONFIG" ]; then
  cp "$CONFIG" "${CONFIG}.bak.$(date +%s)"
  EXISTING=$(cat "$CONFIG")
else
  EXISTING='{}'
fi

UPDATED=$("$PYTHON" - <<PY
import json
cfg = json.loads(r'''$EXISTING''') or {}
cfg.setdefault("mcpServers", {})
cfg["mcpServers"]["talent-hr"] = {
    "command": r"$PYTHON",
    "args": ["-m", "mcp_server.server"],
    "cwd": r"$ROOT",
    "env": {
        "TALENT_API": "http://127.0.0.1:8000",
        "TALENT_TOKEN": r"$TOKEN",
    },
}
print(json.dumps(cfg, ensure_ascii=False, indent=2))
PY
)
printf '%s\n' "$UPDATED" > "$CONFIG"
echo "✓ Claude Desktop の MCP 設定に talent-hr を登録しました。"
echo "  設定ファイル: $CONFIG"
echo "→ Claude Desktop を再起動してください。"
