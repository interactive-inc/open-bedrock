import type { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { uuidSchema } from "@/lib/validation/uuid.schema"
import { createSqliteDatabaseBeforeMigration } from "./migrated-sqlite-database"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

const MIGRATIONS_ROOT = resolve(import.meta.dir, "..", "..", "..", "migrations")

/**
 * 主キーを UUID へ移す migration の検査に使う。対象より前の migration だけを当てた独立 DB を返す。
 * 行の用意は検査対象外のため、呼び出し側は外部キーと CHECK を外して最小の行を入れてよい。
 */
export function databaseBefore(target: string): Database {
  return createSqliteDatabaseBeforeMigration(target)
}

/** 対象の migration を 1 文ずつ当てる。D1 と同じく文の途中で失敗すれば例外を投げる。 */
export function applyMigration(database: Database, target: string): void {
  for (const statement of splitSqlStatements(
    readFileSync(resolve(MIGRATIONS_ROOT, target), "utf8"),
  )) {
    database.run(statement)
  }
}

/** table に付く index と trigger の名前と定義。作り直しの前後で同じ集合であることを比べる。 */
export function dependentObjects(database: Database, table: string) {
  return database
    .query<{ type: string; name: string; sql: string }, [string]>(
      "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ?1 AND type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type, name",
    )
    .all(table)
}

export function isUuid(value: unknown): boolean {
  return uuidSchema.safeParse(value).success
}

/**
 * 証跡の table へ検査用の最小行を入れる。証跡の trigger と CHECK は本物の書込み経路だけを通すため、
 * その table の trigger を外して入れ、元の定義で戻す。migration の停止条件を確かめる用途に限る。
 */
export function insertBypassingGuards(database: Database, table: string, statement: string): void {
  const triggers = database
    .query<{ name: string; sql: string }, [string]>(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?1",
    )
    .all(table)
  for (const trigger of triggers) database.run(`DROP TRIGGER ${trigger.name}`)
  database.run("PRAGMA foreign_keys = OFF")
  database.run("PRAGMA ignore_check_constraints = ON")
  try {
    database.run(statement)
  } finally {
    database.run("PRAGMA ignore_check_constraints = OFF")
    for (const trigger of triggers) database.run(trigger.sql)
  }
}
