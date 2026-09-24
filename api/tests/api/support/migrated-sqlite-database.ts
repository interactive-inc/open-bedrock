import { Database } from "bun:sqlite"

type SchemaTemplate = {
  buffer: Uint8Array
  foreignKeysEnabled: boolean
}

const schemaTemplates = new Map<string, SchemaTemplate>()

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

  const row = source.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()

  const template: SchemaTemplate = {
    buffer: source.serialize(),
    foreignKeysEnabled: row !== null && row.foreign_keys === 1,
  }

  source.close()

  schemaTemplates.set(schema, template)

  return deserializeTemplate(template)
}

function deserializeTemplate(template: SchemaTemplate): Database {
  const copy = Database.deserialize(template.buffer)

  copy.exec(`PRAGMA foreign_keys=${template.foreignKeysEnabled ? "ON" : "OFF"}`)

  return copy
}
