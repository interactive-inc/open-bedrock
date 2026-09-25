import { Database } from "bun:sqlite"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { executeSql } from "../../../scripts/sql-statements"
import { loadSchema } from "./load-schema"

type SchemaTemplate = {
  buffer: Uint8Array
  foreignKeysEnabled: boolean
}

type MigrationOptions = {
  /** 最初の migration の前に PRAGMA foreign_keys を ON にする。既定は SQLite と同じ OFF。 */
  foreignKeys?: boolean
}

const MIGRATIONS_ROOT = resolve(import.meta.dir, "..", "..", "..", "migrations")

/** 途中の状態を残す間隔。4MB ほどの複製を十数個に抑えつつ、途中から当てる migration を少なくする。 */
const CHECKPOINT_INTERVAL = 25

const schemaTemplates = new Map<string, SchemaTemplate>()
const sequenceTemplates = new Map<string, SchemaTemplate>()
const migrationSources = new Map<string, string>()
let migrationFiles: readonly string[] | null = null

/**
 * SQL・migration専用の検査に使う bun:sqlite の独立DBを返す。D1互換ではない。
 * D1のbind、batch、metaの挙動を検証する用途には tests/d1 のローカルD1を使う。
 *
 * schema 全文の exec は migration 全本ぶんで 1 回 600ms を超える。
 * プロセス内で schema ごとに 1 回だけ構築して serialize し、以降は deserialize した
 * 独立コピー（1ms 未満）を返す。PRAGMA は接続ごとの設定でバイト列に乗らないため、
 * 構築直後の foreign_keys の実値を記録してコピー側で復元する。
 */
export function createMigratedSqliteDatabase(schema: string): Database {
  const cached = schemaTemplates.get(schema)

  if (cached !== undefined) {
    return deserializeTemplate(cached)
  }

  const source = new Database(":memory:")

  source.exec(schema)

  const template = serializeTemplate(source)

  source.close()

  schemaTemplates.set(schema, template)

  return deserializeTemplate(template)
}

/** migrations/ の .sql を番号順に並べた名前。 */
export function listMigrationFiles(): readonly string[] {
  migrationFiles ??= readdirSync(MIGRATIONS_ROOT)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  return migrationFiles
}

/** 全 migration を当てた独立 DB を返す。 */
export function createFullyMigratedSqliteDatabase(options: MigrationOptions = {}): Database {
  return createSqliteDatabaseAfterMigrations(listMigrationFiles(), options)
}

/** 対象より前の migration だけを当てた独立 DB を返す。対象の migration の検査に使う。 */
export function createSqliteDatabaseBeforeMigration(
  target: string,
  options: MigrationOptions = {},
): Database {
  const files = listMigrationFiles()
  if (!files.includes(target)) throw new Error(`migration ${target} does not exist`)
  return createSqliteDatabaseAfterMigrations(
    files.filter((file) => file < target),
    options,
  )
}

/**
 * 指定した順に migration を当てた独立 DB を返す。
 *
 * 全 migration の適用は CI で 1 回 5 秒近くかかり、test の既定の制限を超える。同じ並びの
 * 途中の状態を CHECKPOINT_INTERVAL 本ごとに保存し、最も長く一致する途中の状態から残りだけを当てる。
 * 全体の並びは preload の warmMigratedSqliteTemplates が test の前に作る。
 */
export function createSqliteDatabaseAfterMigrations(
  files: readonly string[],
  options: MigrationOptions = {},
): Database {
  const foreignKeys = options.foreignKeys ?? false
  const cached = sequenceTemplates.get(sequenceKey(files, files.length, foreignKeys))
  if (cached !== undefined) return deserializeTemplate(cached)

  let applied = files.length - 1
  let base: SchemaTemplate | undefined
  for (; applied > 0 && base === undefined; applied--) {
    base = sequenceTemplates.get(sequenceKey(files, applied, foreignKeys))
  }
  if (base !== undefined) applied++

  const database = base === undefined ? new Database(":memory:") : deserializeTemplate(base)
  if (base === undefined && foreignKeys) database.exec("PRAGMA foreign_keys = ON")

  for (let index = applied; index < files.length; index++) {
    const file = files[index]
    if (file === undefined) continue
    executeSql(database, readMigration(file), file)
    const count = index + 1
    if (count % CHECKPOINT_INTERVAL === 0 || count === files.length) {
      sequenceTemplates.set(sequenceKey(files, count, foreignKeys), serializeTemplate(database))
    }
  }

  return database
}

/** 全 migration の並びと途中の状態を作る。test の制限の外で呼ぶため bunfig の preload から使う。 */
export function warmMigratedSqliteTemplates(): void {
  createFullyMigratedSqliteDatabase().close()
  createFullyMigratedSqliteDatabase({ foreignKeys: true }).close()

  // 互換ラッパーは loadSchema() の全文を createMigratedSqliteDatabase に渡す。全文を一度に当てた状態は
  // 1 本ずつ当てた状態と schema・行・foreign_keys が同じで、migration が作る乱数の UUID だけが異なる。
  // 同じ状態を登録し、全文の適用を test の中で行わない。
  const full = sequenceTemplates.get(
    sequenceKey(listMigrationFiles(), listMigrationFiles().length, false),
  )
  if (full !== undefined && !schemaTemplates.has(loadSchema()))
    schemaTemplates.set(loadSchema(), full)
}

function sequenceKey(files: readonly string[], count: number, foreignKeys: boolean): string {
  return `${foreignKeys ? "fk" : "no-fk"}:${files.slice(0, count).join(",")}`
}

function readMigration(file: string): string {
  let source = migrationSources.get(file)
  if (source === undefined) {
    source = readFileSync(resolve(MIGRATIONS_ROOT, file), "utf8")
    migrationSources.set(file, source)
  }
  return source
}

function serializeTemplate(database: Database): SchemaTemplate {
  const row = database.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()
  return {
    buffer: database.serialize(),
    foreignKeysEnabled: row !== null && row.foreign_keys === 1,
  }
}

function deserializeTemplate(template: SchemaTemplate): Database {
  const copy = Database.deserialize(template.buffer)

  copy.exec(`PRAGMA foreign_keys=${template.foreignKeysEnabled ? "ON" : "OFF"}`)

  return copy
}
