#!/usr/bin/env bash
# 社内HR統合システム ローカルクイックスタート（macOS / Linux）
# - venv 作成 → 依存導入 → サンプルデータ投入 → API起動
set -euo pipefail

cd "$(dirname "$0")"
PYTHON="${PYTHON:-python3}"
PORT="${PORT:-8000}"

echo "▶ Python: $($PYTHON --version)"
if [ ! -d .venv ]; then
  echo "▶ venv を作成 (.venv)"
  $PYTHON -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
echo "▶ 依存パッケージをインストール"
python -m pip install -r requirements.txt
python -m pip install email-validator >/dev/null

if [ ! -f talent.db ]; then
  echo "▶ サンプルデータ投入 (talent.db)"
  python -m server.seed
else
  echo "▶ talent.db を検出。再シードしたい場合は 'make reseed' を実行してください。"
fi

echo "▶ API を起動: http://127.0.0.1:${PORT}/docs"
echo "  Ctrl-C で停止します。"
exec python -m uvicorn server.main:app --reload --host 127.0.0.1 --port "$PORT"
