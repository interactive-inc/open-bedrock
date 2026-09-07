import { uuidSchema } from "@/lib/uuid/uuid.schema"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { executeSql } from "../../scripts/sql-statements"

/**
 * 主キーを UUID へ移す migration が、既存の連番データを正しく変換することを確認する
 * (Issue #1311)。
 *
 * 新規 DB へ順に適用しただけでは意味が無い。migration は seed より先に走るので、
 * 対象 table は空で、検証表の件数はすべて 0 になり CHECK が何も守らない。本番が通る
 * 経路は「連番データが入っている状態へ migration を当てる」なので、それを再現する。
 */

const apiRoot = resolve(import.meta.dir, "../..")

const migrationsDir = resolve(apiRoot, "migrations")

const seedsDir = resolve(apiRoot, "seeds")

const seedOrder = [
  "employee",
  "org",
  "iam",
  "employee-lifecycle",
  "application",
  "approval-delegation",
  "personnel-action",
  "position",
  "grade",
  "company",
]

/** 指定した migration より前までを適用し、seed も入れた DB を作る。 */
function createDatabaseBefore(migrationPrefix: string, skipSeeds: readonly string[]): Database {
  const database = new Database(":memory:")
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()

  for (const file of files.filter((name) => name.startsWith(migrationPrefix) === false)) {
    executeSql(database, readFileSync(resolve(migrationsDir, file), "utf8"), `migration ${file}`)
  }

  const seedFiles = readdirSync(seedsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
  const ordered = [
    ...seedOrder.map((domain) => `${domain}.sql`),
    ...seedFiles.filter((name) => seedOrder.includes(name.replace(".sql", "")) === false),
  ]

  for (const file of ordered.filter((name) => skipSeeds.includes(name) === false)) {
    const sql = readFileSync(resolve(seedsDir, file), "utf8")

    if (sql.includes("INSERT INTO") === false) {
      continue
    }

    executeSql(database, sql, `seed ${file}`)
  }

  return database
}

/** 対象の migration だけを適用する。 */
function applyMigration(database: Database, migrationPrefix: string): void {
  const file = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .find((name) => name.startsWith(migrationPrefix))

  if (file === undefined) {
    throw new Error(`${migrationPrefix} で始まる migration がありません`)
  }

  executeSql(database, readFileSync(resolve(migrationsDir, file), "utf8"), `migration ${file}`)
}

describe("0080 announcements の UUID 移行", () => {
  /** 連番の announcements が入った状態を作り、0080 を当てる。 */
  function cutover(): Database {
    const database = createDatabaseBefore("0080", ["announcement.sql"])

    database.run(
      `INSERT INTO announcements (id, title, body_md, published_on, author_employee_id, status, created_at)
       VALUES (1, 'a', 'body a', '2026-02-01', '1', 'published', '2026-02-01T09:00:00Z'),
              (2, 'b', 'body b', NULL, '1', 'draft', '2026-02-02T09:00:00Z'),
              (7, 'c', 'body c', NULL, '1', 'draft', '2026-02-03T09:00:00Z')`,
    )

    applyMigration(database, "0080")

    return database
  }

  test("連番 ID がすべて UUID に置き換わる", () => {
    const rows = cutover().query<{ id: string }, []>("SELECT id FROM announcements").all()

    expect(rows).toHaveLength(3)
    expect(rows.every((row) => uuidSchema.safeParse(row.id).success)).toBe(true)
  })

  test("行が失われず、本文と状態は変わらない", () => {
    const rows = cutover()
      .query<{ title: string; status: string }, []>(
        "SELECT title, status FROM announcements ORDER BY created_at",
      )
      .all()

    expect(rows.map((row) => `${row.title}:${row.status}`)).toEqual([
      "a:published",
      "b:draft",
      "c:draft",
    ])
  })

  test("ID は行ごとに異なる", () => {
    const ids = cutover()
      .query<{ id: string }, []>("SELECT id FROM announcements")
      .all()
      .map((row) => row.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  test("検証表が実データの件数を記録する", () => {
    const rows = cutover()
      .query<{ resource: string; source_count: number; target_count: number }, []>(
        "SELECT resource, source_count, target_count FROM _announcements_uuid_cutover_validation ORDER BY resource",
      )
      .all()

    // 空 DB へ順に当てると 0 件になる。ここは実データが数えられていること自体が要点。
    expect(rows.every((row) => row.source_count === 3 && row.target_count === 3)).toBe(true)
  })

  test("社員参照が壊れない", () => {
    const orphans = cutover()
      .query<{ count: number }, []>(
        `SELECT count(*) AS count FROM announcements child
         LEFT JOIN company_employees employee ON employee.id = child.author_employee_id
         WHERE employee.id IS NULL`,
      )
      .get()

    expect(orphans?.count).toBe(0)
  })

  test("対応表は後片付けされる", () => {
    const remaining = cutover()
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE name = '_announcements_id_map'",
      )
      .all()

    expect(remaining).toEqual([])
  })
})
