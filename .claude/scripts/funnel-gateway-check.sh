#!/usr/bin/env bash
# 起動時に funnel gateway の重複/古いプロセスを検出する。
# - open-karte のゲートウェイが複数いたら restart で単一化（取りこぼしの元）
# - 同じ Slack app を奪い合う他プロジェクトのゲートウェイがいたら警告だけ出す
# 出力は SessionStart フック経由でエージェントの文脈に入る。
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PAT='claude-funnel/dist/gateway/daemon.js'

procs="$(ps ax -o pid=,command= | grep "$PAT" | grep -v grep || true)"
own="$(printf '%s\n' "$procs" | grep -F "$ROOT" || true)"
other="$(printf '%s\n' "$procs" | grep -F "$PAT" | grep -vF "$ROOT" || true)"

own_n=$(printf '%s' "$own" | grep -c . || true)
other_n=$(printf '%s' "$other" | grep -c . || true)

if [ "$own_n" -gt 1 ]; then
  echo "[funnel-check] open-karte gateway が ${own_n} 個。restart で単一化します。"
  ( cd "$ROOT" && bunx funnel gateway restart >/dev/null 2>&1 ) && echo "[funnel-check] 単一化しました。"
elif [ "$own_n" -eq 1 ]; then
  echo "[funnel-check] open-karte gateway は 1 個。OK。"
else
  echo "[funnel-check] open-karte gateway は未起動（必要時に起動されます）。"
fi

if [ "$other_n" -gt 0 ]; then
  echo "[funnel-check] 警告: 他プロジェクトの funnel gateway が稼働中。同じ Slack app トークンを共用していると Socket Mode を奪い合い、通知を取りこぼします。確認してください:"
  printf '%s\n' "$other" | sed -E 's#^ *([0-9]+).*src/([^/]+)/.*#  - pid \1  (\2)#'
fi

exit 0
