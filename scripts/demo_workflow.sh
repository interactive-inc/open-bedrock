#!/usr/bin/env bash
# 起動中のAPIに対し、CLI 経由で代表的なワークフローを実行するデモ。
# 事前: 別ターミナルで `make run` が動いていること。
set -euo pipefail
cd "$(dirname "$0")/.."

PY=.venv/bin/python
HOME_BACKUP=$HOME
export HOME=/tmp/talent_demo_home
mkdir -p "$HOME"
export TALENT_API="${TALENT_API:-http://127.0.0.1:8000}"

hr() { echo; echo "── $* ──"; }

hr "1. ログイン (engineer-a)"
$PY -m cli.talent login --email engineer-a@inta.co.jp --password engineer-a

hr "2. 自分の情報"
$PY -m cli.talent whoami

hr "3. 申請テンプレート"
$PY -m cli.talent app templates

hr "4. 住所変更を提出"
cat > /tmp/addr.json <<'JSON'
{
  "new_postal_code": "100-0001",
  "new_address": "東京都千代田区千代田1-1",
  "move_date": "2026-06-01",
  "new_commute": "東京メトロ千代田線 大手町"
}
JSON
$PY -m cli.talent app submit APP-001 --data /tmp/addr.json

hr "5. 上長 (manager) でログイン → inbox → approve"
$PY -m cli.talent login --email manager@inta.co.jp --password manager
$PY -m cli.talent app inbox
# 一番上の申請IDを取得
APP_ID=$(curl -s -H "Authorization: Bearer $($PY -c "import json,os;print(json.load(open(os.path.expanduser('~/.talent/config.json')))['token'])")" \
  "$TALENT_API/applications/inbox" | $PY -c "import sys,json;rows=json.load(sys.stdin);print(rows[0]['id'] if rows else '')")
echo "対象申請ID=$APP_ID"
$PY -m cli.talent app approve "$APP_ID" --comment "問題なし"

hr "6. 人事 (hr) でログイン → inbox → approve"
$PY -m cli.talent login --email hr@inta.co.jp --password hr
$PY -m cli.talent app inbox
$PY -m cli.talent app approve "$APP_ID" --comment "受理しました"

hr "7. 最終状態を確認"
$PY -m cli.talent app show "$APP_ID"

hr "8. ナレッジ検索"
$PY -m cli.talent kb search リモート

hr "9. 会議室の空き → 予約"
$PY -m cli.talent room avail --start 2026-05-19T15:00:00 --end 2026-05-19T16:00:00
$PY -m cli.talent room reserve --room-id 1 --start 2026-05-19T15:00:00 --end 2026-05-19T16:00:00 --purpose デモ

export HOME=$HOME_BACKUP
echo
echo "デモ完了。"
