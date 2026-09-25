import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { execSql } from "@tests/d1/support/exec-sql"

const migrationsDirectory = join(import.meta.dir, "../../../migrations")
const seedsDirectory = join(import.meta.dir, "../../../seeds")

/** seed を当てる順序。verify-seed と同じく、社員と組織を先に入れて外部キーを満たす。 */
const SEED_ORDER = [
  "employee",
  "org",
  "iam",
  "employee-lifecycle",
  "application",
  "approval-delegation",
  "personnel-action",
  "position",
  "grade",
  "company-public-workforce",
]

/**
 * 空のローカルD1へ、対象より前の migration を1ファイルずつ当てる。
 * wrangler と同じく1ファイルを1つの batch として送り、ファイルの途中で止まれば全体を戻す。
 */
export async function migrateLocalD1Before(database: D1Database, target: string): Promise<void> {
  const files = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < target)
    .sort()
  for (const file of files) await applyLocalD1Migration(database, file)
}

export async function applyLocalD1Migration(database: D1Database, file: string): Promise<void> {
  await execSql(database, readFileSync(join(migrationsDirectory, file), "utf8"))
}

/** 開発用 seed を入れる。本番に近い行数と参照関係の上で migration を確かめるために使う。 */
export async function seedLocalD1(database: D1Database): Promise<void> {
  const files = readdirSync(seedsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const ordered = [
    ...SEED_ORDER.map((name) => `${name}.sql`),
    ...files.filter((file) => !SEED_ORDER.includes(file.replace(".sql", ""))),
  ]
  for (const file of ordered) {
    const sql = readFileSync(join(seedsDirectory, file), "utf8")
    if (sql.includes("INSERT INTO")) await execSql(database, sql)
  }
}
