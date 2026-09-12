#!/usr/bin/env bash
set -euo pipefail

api_root="$(cd "$(dirname "$0")/.." && pwd)"
isolated_root="$(mktemp -d "${TMPDIR:-/tmp}/company-core-routes.XXXXXX")"
trap 'rm -rf "$isolated_root"' EXIT

# 業務コードをコピーせず、実ルートと共有テストを変更しないで読み込む。
mkdir -p "$isolated_root/src/contexts"
cp -R "$api_root/src/contexts/system" "$isolated_root/src/contexts/system"
cp -R "$api_root/src/contexts/company" "$isolated_root/src/contexts/company"
cp -R "$api_root/src/lib" "$isolated_root/src/lib"
cp "$api_root/tsconfig.json" "$isolated_root/tsconfig.json"
ln -s "$api_root/node_modules" "$isolated_root/node_modules"

# 過去の移行列と業務テーブルは保全する。業務コードの除去とは別に扱う。
if [[ -d "$api_root/migrations" ]]; then
  cp -R "$api_root/migrations" "$isolated_root/migrations"
else
  cp -R "$api_root/drizzle" "$isolated_root/drizzle"
fi

cat > "$isolated_root/package.json" <<'JSON'
{"type":"module"}
JSON
cat > "$isolated_root/core-entry.ts" <<'TS'
import * as company from "@/contexts/company/interface/routes/company"
import * as system from "@system/interface/routes/system"

for (const groups of [company, system]) {
  for (const routes of Object.values(groups)) {
    if (routes.routes.length === 0) throw new Error("Empty core route group")
  }
}
console.log("System and Company route groups loaded without business source")
TS

cd "$isolated_root"
bun run core-entry.ts
bun build core-entry.ts --target=bun --outfile=core-bundle.js
bun run core-bundle.js
bun test --timeout 15000 \
  src/contexts/company/interface/routes/company.bootstrap.test.ts \
  src/contexts/system/test/attachment-evidence.integration.test.ts \
  src/contexts/system/test/system-notification-application.integration.test.ts \
  src/contexts/system/test/system-procedure-application.integration.test.ts \
  src/contexts/system/test/system-case-read-guard.integration.test.ts \
  src/contexts/system/test/system-workflow-application.integration.test.ts
