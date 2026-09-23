import { Database } from "bun:sqlite"
import { Glob } from "bun"
import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { resolveTableOwner } from "../../scripts/check-table-ownership-isolation"
import { executeSql } from "../../scripts/sql-statements"

const PROJECT_ROOT = resolve(import.meta.dir, "..", "..")
const CONTEXTS_ROOT = resolve(PROJECT_ROOT, "src", "contexts")
const MIGRATIONS_ROOT = resolve(PROJECT_ROOT, "migrations")
const FOUNDATION_CONTEXTS = new Set(["system", "company"])

type Source = Readonly<{ context: string; file: string; text: string }>

async function readProductionSources(): Promise<Source[]> {
  const sources: Source[] = []
  for await (const file of new Glob("**/*.ts").scan(CONTEXTS_ROOT)) {
    if (/\.test\.ts$|\.test-support\.ts$|(^|\/)test\//u.test(file)) continue
    const context = file.split("/")[0]
    if (context === undefined) continue
    sources.push({ context, file, text: readFileSync(resolve(CONTEXTS_ROOT, file), "utf8") })
  }
  return sources
}

function migrate(): Database {
  const database = new Database(":memory:")
  const files = readdirSync(MIGRATIONS_ROOT)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  for (const file of files)
    executeSql(database, readFileSync(resolve(MIGRATIONS_ROOT, file), "utf8"), `migration ${file}`)
  return database
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

async function listBusinessTables() {
  const sources = await readProductionSources()
  const contexts = readdirSync(CONTEXTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const declaredOwners = new Map<string, string>()
  for (const source of sources) {
    for (const match of source.text.matchAll(/sqliteTable\(\s*["'`]([a-z][a-z0-9_]*)["'`]/gu)) {
      const table = match[1]
      if (table !== undefined && !declaredOwners.has(table))
        declaredOwners.set(table, source.context)
    }
  }
  const database = migrate()
  const tables = database
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
    )
    .all()
    .flatMap(({ name }) => {
      const owner = resolveTableOwner(name, declaredOwners, contexts)
      return owner === null || FOUNDATION_CONTEXTS.has(owner) ? [] : [{ table: name, owner }]
    })
  return { database, sources, tables }
}

test("業務の全tableは撤去の停止中にDB確定時の書込みを拒否する", async () => {
  const { database, tables } = await listBusinessTables()
  const triggers = database
    .query<{ tbl_name: string; sql: string }, []>(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type='trigger'",
    )
    .all()
  const unguarded = tables.flatMap(({ table, owner }) => {
    const guards = triggers.filter((trigger) => trigger.tbl_name === table)
    return ["INSERT", "UPDATE", "DELETE"]
      .filter(
        (operation) =>
          !guards.some(
            (trigger) =>
              new RegExp(`BEFORE\\s+${operation}\\b`, "iu").test(trigger.sql) &&
              // 停止世代に連動する trigger か、常に拒否する不変条件の trigger だけを保護とみなす。
              (/system_record_source_freezes/u.test(trigger.sql) ||
                !/\bWHEN\b/iu.test(trigger.sql)),
          ),
      )
      .map((operation) => `${owner}:${table}:${operation}`)
  })

  expect(unguarded).toEqual([])
})

test("業務の全tableの全列を所有業務の保全原文へ含める", async () => {
  const { database, sources, tables } = await listBusinessTables()
  const missing = tables.flatMap(({ table, owner }) => {
    const owned = sources.filter((source) => source.context === owner)
    const columns = database
      .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
      .all()
      .map(({ name }) => name)
    // 原文は保全用の capture または snapshot の json_object SQL で作るか、table と列の一覧から組み立てる。
    const snapshotSql = owned
      .filter(
        (source) =>
          /(?:capture|snapshot)[^/]*\.ts$/u.test(source.file) &&
          /json_object\(/u.test(source.text) &&
          new RegExp(`\\bFROM\\s+${escape(table)}\\b`, "iu").test(source.text),
      )
      .map((source) => source.text)
      .join("\n")
    const columnList = owned
      .filter((source) => new RegExp(`table:\\s*"${escape(table)}"`, "u").test(source.text))
      .map((source) => source.text)
      .join("\n")
    if (snapshotSql.length === 0 && columnList.length === 0) return [`${owner}:${table}:*`]
    return columns
      .filter(
        (column) =>
          !new RegExp(`'${escape(column)}'\\s*,`, "u").test(snapshotSql) &&
          !new RegExp(`"${escape(column)}"`, "u").test(columnList),
      )
      .map((column) => `${owner}:${table}:${column}`)
  })

  expect(missing).toEqual([])
})
