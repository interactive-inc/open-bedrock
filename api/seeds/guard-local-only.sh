#!/usr/bin/env bash
# シードデータの本番投入を防止するガードスクリプト。
# wrangler d1 execute を --local（既定）でのみ実行し、
# --remote が指定された場合は拒否して終了する。
#
# 使い方:
#   bash api/seeds/guard-local-only.sh <database-name> <sql-file>
#
# 例:
#   bash api/seeds/guard-local-only.sh open-karte api/seeds/employee.sql

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: bash api/seeds/guard-local-only.sh <database-name> <sql-file>" >&2
  exit 1
fi

DATABASE_NAME="$1"
SQL_FILE="$2"

# 残りの引数に --remote が含まれていたら拒否する
shift 2
for arg in "$@"; do
  if [ "$arg" = "--remote" ]; then
    echo "ERROR: seed data is for local development only. --remote is not allowed." >&2
    echo "本番環境の初期化は運用手順書に従ってください。" >&2
    exit 1
  fi
done

# WRANGLER_ENV / CLOUDFLARE_ENV が production 相当でないかも確認する
if [ "${WRANGLER_ENV:-}" = "production" ] || [ "${CLOUDFLARE_ENV:-}" = "production" ]; then
  echo "ERROR: seed data cannot be applied in production environment." >&2
  echo "WRANGLER_ENV or CLOUDFLARE_ENV is set to 'production'." >&2
  exit 1
fi

echo "Seeding local D1: ${DATABASE_NAME} with ${SQL_FILE} ..."
exec npx wrangler d1 execute "$DATABASE_NAME" --file "$SQL_FILE" "$@"
