/**
 * UUID の CHECK 制約が実際の D1 (miniflare) で成立することを確認する (Issue #1311)。
 *
 * `bun:sqlite` と D1 は同じ SQLite ではない。文字クラスを 36 個並べた GLOB は
 * `bun:sqlite` が通す一方、D1 は "LIKE or GLOB pattern too complex" で拒否する。
 * つまり in-memory の test が緑でも migration が本番で落ち得る。
 *
 * `bun test` からは動かせない (wrangler とローカル D1 が要る) ので、独立した script
 * にしてある。CHECK 制約を含む migration を追加した段では必ずこれを実行すること。
 *
 *   bun run verify-uuid-check-on-d1
 */
import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"

const TABLE = "_uuid_check_d1_probe"

const accepted = ["01900000-0000-7000-8000-000000000a01", "4e70a050-497b-482e-9766-6937dca05295"]

const rejected = [
  "1",
  "organization:default",
  "11111111-1111-1111-1111-111111111111",
  "00000000-0000-0000-0000-000000000000",
  "4E70A050-497B-482E-9766-6937DCA05295",
  "0190000--0000-7000-8000-000000000a01",
]

/** wrangler 経由でローカル D1 に SQL を流す。失敗しても投げず結果を返す。 */
async function execute(sql: string): Promise<{ ok: boolean; output: string }> {
  const result = Bun.spawnSync([
    "bunx",
    "wrangler",
    "d1",
    "execute",
    "bedrock",
    "--local",
    "--command",
    sql,
  ])
  const output = `${result.stdout.toString()}${result.stderr.toString()}`

  return { ok: result.exitCode === 0 && output.includes("ERROR") === false, output }
}

const violations: string[] = []

await execute(`DROP TABLE IF EXISTS ${TABLE}`)

const created = await execute(
  `CREATE TABLE ${TABLE} (id TEXT NOT NULL, CHECK (${uuidCheckPredicate("id")}))`,
)

if (created.ok === false) {
  // ここで落ちるなら述語自体が D1 で使えない。migration も同じ理由で落ちる。
  console.error("CHECK 制約を D1 が受け付けませんでした:")
  console.error(created.output.trim())
  process.exit(1)
}

for (const value of accepted) {
  const inserted = await execute(`INSERT INTO ${TABLE} (id) VALUES ('${value}')`)

  if (inserted.ok === false) {
    violations.push(`本来通るべき値が D1 で拒否されました: ${value}`)
  }
}

for (const value of rejected) {
  const inserted = await execute(`INSERT INTO ${TABLE} (id) VALUES ('${value}')`)

  if (inserted.ok) {
    violations.push(`本来拒否すべき値が D1 で通りました: ${value}`)
  }
}

await execute(`DROP TABLE IF EXISTS ${TABLE}`)

if (violations.length > 0) {
  console.error(violations.join("\n"))
  process.exit(1)
}

console.log(`UUID CHECK D1 OK — ${accepted.length} accepted / ${rejected.length} rejected`)
