#!/usr/bin/env bash
set -euo pipefail

api_root="$(cd "$(dirname "$0")/.." && pwd)"
isolated_root="$(mktemp -d "${TMPDIR:-/tmp}/company-core-worker.XXXXXX")"
trap 'rm -rf "$isolated_root"' EXIT

mkdir -p "$isolated_root/src/contexts"
for context in system company; do
  cp -R "$api_root/src/contexts/$context" "$isolated_root/src/contexts/$context"
done
for directory in src/api src/lib scripts migrations; do
  cp -R "$api_root/$directory" "$isolated_root/$directory"
done
cp "$api_root/tsconfig.json" "$isolated_root/tsconfig.json"
cp "$api_root/src/env.ts" "$isolated_root/src/env.ts"
cp "$api_root/src/schema.ts" "$isolated_root/src/schema.ts"
ln -s "$api_root/node_modules" "$isolated_root/node_modules"
printf '{"type":"module"}\n' > "$isolated_root/package.json"

# 配備の合成だけを基盤構成へ変え、認証・認可middlewareとcontext実装は変更しない。
rm -rf "$isolated_root/src/api/routes" "$isolated_root/src/api/scheduled"
cat > "$isolated_root/src/api/route-module.registry.ts" <<'TS'
import { systemContextModule } from "@system/interface/module"
import { companyContextModule } from "@/contexts/company/interface/module"
export const ROUTE_MODULE_REGISTRY = [systemContextModule, companyContextModule]
TS
cat > "$isolated_root/src/index.ts" <<'TS'
import { app } from "@/api/app"
export default { fetch: app.fetch }
TS
cat > "$isolated_root/select-core-schema.ts" <<'TS'
import { readFileSync, writeFileSync } from "node:fs"
const source = readFileSync("src/schema.ts", "utf8")
const removed = new Set<string>()
const imports = source.split("\n").filter((line) => {
  const match = /^import \* as (\w+) from "@\/contexts\/([^/]+)\//.exec(line)
  if (match === null || match[2] === "system" || match[2] === "company") return true
  removed.add(match[1])
  return false
})
writeFileSync("src/schema.ts", imports.filter((line) => {
  const match = /^  \.\.\.(\w+),$/.exec(line)
  return match === null || !removed.has(match[1])
}).join("\n"))
TS

cat > "$isolated_root/core-worker-check.ts" <<'TS'
import { strict as assert } from "node:assert"
import { readFileSync, readdirSync } from "node:fs"
import { app } from "@/api/app"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const migrationSql = readdirSync("migrations").filter((file) => file.endsWith(".sql"))
  .sort().map((file) => readFileSync(`migrations/${file}`, "utf8")).join("\n")
const env = {
  DB: createCompanyD1TestDatabase(migrationSql),
  BOOTSTRAP_TOKEN: "isolated-bootstrap-test-token",
  JWT_SECRET: "isolated-bootstrap-test-jwt-secret",
  PEPPER_SECRET: "isolated-bootstrap-test-pepper",
  AUDIT_HMAC_SECRET: "isolated-bootstrap-test-audit",
  COMPANY_TIME_ZONE: "Asia/Tokyo",
}
const bootstrap = await app.request("/system/bootstrap", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: env.BOOTSTRAP_TOKEN, email: "root@example.com", password: "correct horse battery staple" }),
}, env)
assert.equal(bootstrap.status, 201, await bootstrap.text())
const session = await app.request("/system/sessions", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ subject: "root@example.com", password: "correct horse battery staple" }),
}, env)
assert.equal(session.status, 201)
const login = await session.json()
const headers = { authorization: `Bearer ${login.access_token}`, "content-type": "application/json", "idempotency-key": "isolated-company-bootstrap" }
const company = await app.request("/company/bootstrap", {
  method: "POST", headers,
  body: JSON.stringify({ name: "First Member", code: "FIRST-001", organization_name: "Example Company",
    representative_name: "Confirmed Representative", initial_responsibilities: [], hire_date: "2026-01-01",
    employment_type: "PART_TIME", locale: "ja-JP", time_zone: "Asia/Tokyo", fiscal_year_start_month: 4,
    reason: "Confirmed isolated company facts" }),
}, env)
assert.equal(company.status, 201, await company.text())
for (const path of ["/company/employments", "/company/definitions", "/company/changes"]) {
  const response = await app.request(path, { headers: { ...headers, "x-company-organization-id": "organization:default" } }, env)
  assert.equal(response.status, 200, `${path}: ${await response.text()}`)
}
const denied = await app.request("/system/proposals/1/versions/1", { headers }, env)
assert.equal(denied.status, 403)
for (const path of ["/leave/applications", "/attendance", "/onboarding"]) {
  const response = await app.request(path, { headers: { ...headers, "x-company-organization-id": "organization:default" } }, env)
  assert.equal(response.status, 404, path)
}
console.log("Core Worker composition: bootstrap, password login, Company reads, authorization and absent business routes verified")
TS

cd "$isolated_root"
bun run select-core-schema.ts
bun run scripts/gen-app.ts
bun build src/index.ts --target=bun --outfile=core-worker.js
bun run core-worker-check.ts
