#!/usr/bin/env bash
# D1 に初期 seed を投入する。依存順（employee → org → 各ドメイン）で
# seeds/<domain>.sql を 1 ファイルずつ wrangler d1 execute に流す。
# 巨大な結合ファイルは作らない（個別ファイルを順次適用）。
#
# usage:
#   scripts/seed.sh --local    # ローカル D1 (miniflare)
#   scripts/seed.sh --remote   # 本番 D1
set -euo pipefail

TARGET="${1:---local}"
# wrangler.jsonc の d1_databases[].database_name と一致させる。
DB_NAME="bedrock"
SEEDS_DIR="$(cd "$(dirname "$0")/../seeds" && pwd)"

# 依存順。employee（employees）と org（departments 等）を先に。
ORDER=(employee org employee-lifecycle)

apply() {
  local file="$1"
  # INSERT を含まない seed（auth/dashboard 等の説明のみ）はスキップ。
  if ! grep -q "INSERT INTO" "$file"; then
    return 0
  fi
  echo "seeding $(basename "$file")"
  # bunx で devDependency に固定した wrangler を使う。素の `wrangler` はグローバル版に
  # 解決され、migration を流した版と miniflare の状態形式が食い違って落ちる。
  bunx wrangler d1 execute "$DB_NAME" "$TARGET" --file="$file"
}

# 先に基盤ドメイン
for domain in "${ORDER[@]}"; do
  apply "$SEEDS_DIR/$domain.sql"
done

# 残りをアルファベット順（基盤ドメインは除外）
for file in "$SEEDS_DIR"/*.sql; do
  base="$(basename "$file" .sql)"
  skip=false
  for done_domain in "${ORDER[@]}"; do
    if [ "$base" = "$done_domain" ]; then
      skip=true
      break
    fi
  done
  if [ "$skip" = false ]; then
    apply "$file"
  fi
done

echo "seed complete"
