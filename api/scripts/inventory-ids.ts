/**
 * 全 migration を適用した schema から、table ごとの主キーと参照関係を棚卸しする。
 *
 *   bun run gen:id-inventory         api/id-inventory.json を生成する
 *   bun run gen:id-inventory:check   生成物のずれと未分類の参照を検出する
 *
 * 主キーを UUID へ揃える移行 (Issue #1311) の各段が、変換対象・外部キーの張り替え・
 * trigger と view の書き換え範囲をここから決める。人が判断する分類は
 * `id-inventory-registry.ts` に置き、未分類があれば失敗させる。
 */
import { Database } from "bun:sqlite"
import { Glob } from "bun"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"
import { uuidCheckPredicate } from "../src/lib/validation/uuid.schema"
import { resolveTableOwner } from "./check-table-ownership-isolation"
import {
  BUSINESS_CODE_TEXT_PRIMARY_KEY_TABLES,
  PERMANENT_NON_UUID_PRIMARY_KEYS,
  PREFIXED_TEXT_PRIMARY_KEY_TABLES,
  SOFT_REFERENCES,
  type SoftReference,
  type SoftReferenceClassification,
} from "./id-inventory-registry"
import { executeSql } from "./sql-statements"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const CONTEXTS_ROOT = resolve(PROJECT_ROOT, "src", "contexts")
const MIGRATIONS_ROOT = resolve(PROJECT_ROOT, "migrations")
const INVENTORY_PATH = resolve(PROJECT_ROOT, "id-inventory.json")
const SOFT_REFERENCE_COLUMN = /_(id|code|key|ref)$/
const TABLE_DECLARATION_PATTERN = /sqliteTable\(\s*["'`]([a-z][a-z0-9_]*)["'`]/gu

export type PrimaryKeyKind =
  | "integer"
  | "text-uuid"
  | "text-uuid-candidate"
  | "text-prefixed"
  | "text-business-code"
  | "composite"
  | "allocator-singleton-secret"

type ForeignKey = Readonly<{
  table: string
  columns: ReadonlyArray<string>
  to: ReadonlyArray<string | null>
  onDelete: string
}>

export type TableInventory = Readonly<{
  owner: string | null
  primaryKey: Readonly<{
    columns: ReadonlyArray<Readonly<{ name: string; type: string }>>
    kind: PrimaryKeyKind
    uuidEnforced: boolean
    inheritsFrom?: string
  }>
  foreignKeys: Readonly<{
    outgoing: ReadonlyArray<ForeignKey>
    incoming: ReadonlyArray<ForeignKey>
  }>
  softReferences: ReadonlyArray<
    Readonly<{ column: string; classification: SoftReferenceClassification; target?: string }>
  >
  triggers: ReadonlyArray<string>
  views: ReadonlyArray<string>
  indexes: ReadonlyArray<string>
}>

export type IdInventory = Readonly<{
  summary: Readonly<{
    tables: number
    primaryKeyKinds: Readonly<Record<string, number>>
    declaredForeignKeys: number
    softReferences: Readonly<Record<string, number>>
    triggers: number
    views: number
    indexes: number
  }>
  tables: Readonly<Record<string, TableInventory>>
}>

export type IdInventoryProblem = Readonly<{ reason: string }>

type ColumnRow = { name: string; type: string; pk: number }

type ForeignKeyRow = {
  id: number
  seq: number
  table: string
  from: string
  to: string | null
  on_delete: string
}

type SchemaObject = { type: string; name: string; tbl_name: string; sql: string | null }

let migratedSchema: Database | null = null

/** 全 migration を適用した schema。読むだけなので process 内で使い回す。 */
function loadMigratedSchema(): Database {
  if (migratedSchema !== null) return migratedSchema
  const database = new Database(":memory:")
  for (const file of readdirSync(MIGRATIONS_ROOT)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    executeSql(database, readFileSync(resolve(MIGRATIONS_ROOT, file), "utf8"), `migration ${file}`)
  }
  migratedSchema = database
  return database
}

function loadDeclaredOwners(): { owners: Map<string, string>; contexts: string[] } {
  const contexts = readdirSync(CONTEXTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const owners = new Map<string, string>()
  // table の宣言は各 context の infrastructure/schema にだけ置かれる。
  const files = [...new Glob("*/infrastructure/schema/**/*.ts").scanSync(CONTEXTS_ROOT)]
    .filter((file) => !/\.test\.tsx?$/u.test(file))
    .sort()
  for (const file of files) {
    const context = file.split("/")[0]
    if (context === undefined) continue
    for (const match of readFileSync(resolve(CONTEXTS_ROOT, file), "utf8").matchAll(
      TABLE_DECLARATION_PATTERN,
    )) {
      const table = match[1]
      if (table !== undefined && !owners.has(table)) owners.set(table, context)
    }
  }
  return { owners, contexts }
}

function mentions(sql: string | null, table: string, pattern: RegExp): boolean {
  return sql !== null && sql.includes(table) && pattern.test(sql)
}

function normalizeSql(sql: string): string {
  return sql.replaceAll(/[\s"`]+/g, " ")
}

function groupForeignKeys(rows: ReadonlyArray<ForeignKeyRow>): ForeignKey[] {
  const grouped = new Map<number, ForeignKeyRow[]>()
  for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row])
  return [...grouped.values()]
    .map((group) => group.toSorted((left, right) => left.seq - right.seq))
    .map((group) => ({
      table: group[0]?.table ?? "",
      columns: group.map((row) => row.from),
      to: group.map((row) => row.to),
      onDelete: group[0]?.on_delete ?? "NO ACTION",
    }))
}

function countBy(values: ReadonlyArray<string>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values.toSorted()) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

/** 全 migration を適用した schema と分類台帳から棚卸しを組み立てる。 */
export function buildIdInventory(
  softReferences: Readonly<Record<string, SoftReference>> = SOFT_REFERENCES,
): { inventory: IdInventory; problems: IdInventoryProblem[] } {
  const database = loadMigratedSchema()
  const problems: IdInventoryProblem[] = []
  const { owners, contexts } = loadDeclaredOwners()
  const objects = database
    .query<SchemaObject, []>(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
    )
    .all()
  const tableObjects = objects.filter((object) => object.type === "table")
  const tableNames = tableObjects.map((object) => object.name)
  const tableSet = new Set(tableNames)

  const columnsByTable = new Map<string, ColumnRow[]>()
  const outgoingByTable = new Map<string, ForeignKey[]>()
  for (const table of tableNames) {
    columnsByTable.set(table, database.query<ColumnRow, []>(`PRAGMA table_info("${table}")`).all())
    outgoingByTable.set(
      table,
      groupForeignKeys(
        database.query<ForeignKeyRow, []>(`PRAGMA foreign_key_list("${table}")`).all(),
      ),
    )
  }

  const softReferenceKeys = new Set<string>()
  const softReferencesByTable = new Map<string, TableInventory["softReferences"][number][]>()
  for (const table of tableNames) {
    const foreignKeyColumns = new Set(
      (outgoingByTable.get(table) ?? []).flatMap((foreignKey) => foreignKey.columns),
    )
    const references: TableInventory["softReferences"][number][] = []
    for (const column of columnsByTable.get(table) ?? []) {
      if (!SOFT_REFERENCE_COLUMN.test(column.name) || foreignKeyColumns.has(column.name)) continue
      const key = `${table}.${column.name}`
      softReferenceKeys.add(key)
      const entry = softReferences[key]
      if (entry === undefined) {
        problems.push({
          reason: `未分類の参照列です。id-inventory-registry.ts の SOFT_REFERENCES に分類を足してください: ${key}`,
        })
        continue
      }
      if (entry.target !== undefined && !tableSet.has(entry.target)) {
        problems.push({ reason: `分類の参照先 table が存在しません: ${key} -> ${entry.target}` })
      }
      references.push({
        column: column.name,
        classification: entry.classification,
        ...(entry.target === undefined ? {} : { target: entry.target }),
      })
    }
    softReferencesByTable.set(table, references)
  }

  for (const key of Object.keys(softReferences)) {
    if (!softReferenceKeys.has(key)) {
      problems.push({
        reason: `外部キーを持たない参照列として存在しない分類です。台帳から削除してください: ${key}`,
      })
    }
  }
  for (const table of [
    ...PERMANENT_NON_UUID_PRIMARY_KEYS.keys(),
    ...PREFIXED_TEXT_PRIMARY_KEY_TABLES,
    ...BUSINESS_CODE_TEXT_PRIMARY_KEY_TABLES,
  ]) {
    if (!tableSet.has(table)) problems.push({ reason: `台帳の table が存在しません: ${table}` })
  }

  function primaryKeyColumns(table: string): ColumnRow[] {
    return (columnsByTable.get(table) ?? [])
      .filter((column) => column.pk > 0)
      .toSorted((left, right) => left.pk - right.pk)
  }

  function isUuidEnforced(table: string): boolean {
    const columns = primaryKeyColumns(table)
    const column = columns[0]
    if (columns.length !== 1 || column === undefined || column.type.toUpperCase() !== "TEXT") {
      return false
    }
    const definition = tableObjects.find((object) => object.name === table)?.sql ?? ""
    return normalizeSql(definition).includes(normalizeSql(uuidCheckPredicate(column.name)))
  }

  /** 単一列の主キーが親の主キーをそのまま使う 1:1 の拡張 table なら親を返す。 */
  function parentOf(table: string): string | undefined {
    const [column, ...rest] = primaryKeyColumns(table)
    if (column === undefined || rest.length > 0) return undefined
    const declared = (outgoingByTable.get(table) ?? []).find(
      (foreignKey) => foreignKey.columns.length === 1 && foreignKey.columns[0] === column.name,
    )
    const soft = softReferences[`${table}.${column.name}`]
    const parent =
      declared?.table ??
      (soft?.classification === "same-context" || soft?.classification === "cross-context"
        ? soft.target
        : undefined)
    // 親の主キーが複合なら、この列は親の識別子の一部でしかなく、親の形を継がない。
    return parent !== undefined && primaryKeyColumns(parent).length === 1 ? parent : undefined
  }

  function kindOf(table: string, visited: ReadonlySet<string> = new Set()): PrimaryKeyKind {
    if (PERMANENT_NON_UUID_PRIMARY_KEYS.has(table)) return "allocator-singleton-secret"
    const columns = primaryKeyColumns(table)
    const column = columns[0]
    if (columns.length > 1) return "composite"
    if (column === undefined) return "integer"
    if (column.type.toUpperCase() === "INTEGER") return "integer"
    if (isUuidEnforced(table)) return "text-uuid"
    const parent = parentOf(table)
    if (parent !== undefined && parent !== table && !visited.has(parent)) {
      return kindOf(parent, new Set([...visited, table]))
    }
    if (PREFIXED_TEXT_PRIMARY_KEY_TABLES.has(table)) return "text-prefixed"
    if (
      column.name === "code" ||
      column.name === "key" ||
      BUSINESS_CODE_TEXT_PRIMARY_KEY_TABLES.has(table)
    ) {
      return "text-business-code"
    }
    return "text-uuid-candidate"
  }

  const tables: Record<string, TableInventory> = {}
  for (const table of tableNames) {
    const columns = primaryKeyColumns(table)
    if (columns.length === 0) problems.push({ reason: `主キーがありません: ${table}` })
    const parent = parentOf(table)
    const incoming = tableNames.flatMap((source) =>
      (outgoingByTable.get(source) ?? [])
        .filter((foreignKey) => foreignKey.table === table)
        .map((foreignKey) => ({ ...foreignKey, table: source })),
    )
    const pattern = new RegExp(`(?<![A-Za-z0-9_])${table}(?![A-Za-z0-9_])`, "u")
    tables[table] = {
      owner: resolveTableOwner(table, owners, contexts),
      primaryKey: {
        columns: columns.map((column) => ({ name: column.name, type: column.type.toUpperCase() })),
        kind: kindOf(table),
        uuidEnforced: isUuidEnforced(table),
        ...(parent === undefined ? {} : { inheritsFrom: parent }),
      },
      foreignKeys: { outgoing: outgoingByTable.get(table) ?? [], incoming },
      softReferences: softReferencesByTable.get(table) ?? [],
      triggers: objects
        .filter((object) => object.type === "trigger" && mentions(object.sql, table, pattern))
        .map((object) => object.name),
      views: objects
        .filter((object) => object.type === "view" && mentions(object.sql, table, pattern))
        .map((object) => object.name),
      indexes: objects
        .filter((object) => object.type === "index" && object.tbl_name === table)
        .map((object) => object.name),
    }
  }

  const entries = Object.values(tables)
  return {
    inventory: {
      summary: {
        tables: tableNames.length,
        primaryKeyKinds: countBy(entries.map((entry) => entry.primaryKey.kind)),
        declaredForeignKeys: entries.reduce(
          (total, entry) => total + entry.foreignKeys.outgoing.length,
          0,
        ),
        softReferences: countBy(
          entries.flatMap((entry) =>
            entry.softReferences.map((reference) => reference.classification),
          ),
        ),
        triggers: objects.filter((object) => object.type === "trigger").length,
        views: objects.filter((object) => object.type === "view").length,
        indexes: objects.filter((object) => object.type === "index").length,
      },
      tables,
    },
    problems,
  }
}

const PRINT_WIDTH = 100

/**
 * 整形器 (`vp check`) と同じ形で JSON を描く。object は常に展開し、値が primitive だけの
 * 配列は 1 行に収まれば 1 行で書く。生成直後に `vp check` が落ちないようにするため。
 */
function renderJson(
  value: unknown,
  indent: string,
  prefixLength: number,
  suffixLength: number,
): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    if (value.every((item) => item === null || typeof item !== "object")) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
      // 後ろに続く "," を含めて収まるかを見る。
      if (indent.length + prefixLength + inline.length + suffixLength <= PRINT_WIDTH) return inline
    }
    const inner = `${indent}  `
    return `[\n${value
      .map(
        (item, index) => `${inner}${renderJson(item, inner, 0, index < value.length - 1 ? 1 : 0)}`,
      )
      .join(",\n")}\n${indent}]`
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
    if (entries.length === 0) return "{}"
    const inner = `${indent}  `
    return `{\n${entries
      .map(([key, item], index) => {
        const prefix = `${JSON.stringify(key)}: `
        const suffixLength = index < entries.length - 1 ? 1 : 0
        return `${inner}${prefix}${renderJson(item, inner, prefix.length, suffixLength)}`
      })
      .join(",\n")}\n${indent}}`
  }
  return JSON.stringify(value)
}

export function renderIdInventory(inventory: IdInventory): string {
  return `${renderJson(inventory, "", 0, 0)}\n`
}

if (import.meta.main) {
  const { inventory, problems } = buildIdInventory()

  for (const problem of problems) console.error(problem.reason)
  if (problems.length > 0) process.exit(1)

  if (process.argv.includes("--check")) {
    const committed: unknown = JSON.parse(readFileSync(INVENTORY_PATH, "utf8"))
    if (JSON.stringify(committed) !== JSON.stringify(inventory)) {
      console.error(
        "id-inventory.json が migration と台帳に追従していません。`bun run gen:id-inventory` を実行してください",
      )
      process.exit(1)
    }
    console.log(`ID INVENTORY OK — ${inventory.summary.tables} tables`)
  } else {
    writeFileSync(INVENTORY_PATH, renderIdInventory(inventory))
    console.log(`id-inventory.json を生成しました — ${inventory.summary.tables} tables`)
  }
}
