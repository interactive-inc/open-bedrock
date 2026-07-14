import { Database } from "bun:sqlite"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

const migrationsDir = join(root, "migrations")

const seedsDir = join(root, "seeds")

// 安全ガード: 想定外に巨大なファイルがあれば中断（自己参照膨張の再発防止）。
function assertSane(path: string): void {
  const size = statSync(path).size

  if (size > 1_000_000) {
    throw new Error(`${path} is ${size} bytes — too large, aborting`)
  }
}

const db = new Database(":memory:")

// migrations を結合して適用（個々の空ファイル対策）。
const schema = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => {
    const path = join(migrationsDir, file)

    assertSane(path)

    return readFileSync(path, "utf8")
  })
  .join("\n")

db.exec(schema)

// seeds を依存順（employee → org → 残り）に 1 ファイルずつ適用。
const order = ["employee", "org", "employee-lifecycle"]

const seedFiles = readdirSync(seedsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()

const ordered = [
  ...order.map((domain) => `${domain}.sql`),
  ...seedFiles.filter((file) => order.includes(file.replace(".sql", "")) === false),
]

for (const file of ordered) {
  const path = join(seedsDir, file)

  assertSane(path)

  const sql = readFileSync(path, "utf8")

  if (sql.includes("INSERT INTO") === false) {
    continue
  }

  db.exec(sql)
}

const lifecycleState = db
  .query("SELECT status, employee_count FROM lifecycle_migration_state WHERE id = 1")
  .get() as { status: string; employee_count: number }
const employeeCount = (
  db.query("SELECT COUNT(*) AS count FROM employees").get() as {
    count: number
  }
).count
const baselineCount = (
  db
    .query("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'legacy_baseline'")
    .get() as { count: number }
).count

if (
  lifecycleState.status !== "verified" ||
  lifecycleState.employee_count !== employeeCount ||
  baselineCount !== employeeCount
) {
  throw new Error("employee lifecycle seed is incomplete")
}

const tables = (
  db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{
    name: string
  }>
).map((row) => row.name)

let total = 0

for (const table of tables.sort()) {
  const result = db.query(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }

  total += result.count

  console.log(`${table} = ${result.count}`)
}

console.log(`\n${tables.length} tables, ${total} seeded rows — SEED OK`)
