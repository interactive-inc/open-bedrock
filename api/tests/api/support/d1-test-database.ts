import { Database } from "bun:sqlite"

type SchemaTemplate = {
  buffer: Uint8Array
  foreignKeysEnabled: boolean
}

const schemaTemplates = new Map<string, SchemaTemplate>()

/**
 * schema 全文の exec は migration 全本ぶんで 1 回 600ms を超える。
 * プロセス内で schema ごとに 1 回だけ構築して serialize し、以降は deserialize した
 * 独立コピー（1ms 未満）を返す。PRAGMA は接続ごとの設定でバイト列に乗らないため、
 * 構築直後の foreign_keys の実値を記録してコピー側で復元する。
 */
function createSqliteFromSchema(schema: string): Database {
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

/**
 * テスト用: bun:sqlite を D1Database 互換インターフェースで包む。
 * 本番は Cloudflare D1。テストはこのインメモリ SQLite を env.DB に注入する。
 * D1 の型（abstract class）を別実装で満たす境界アダプタのため、最小限の型アサーションを使う。
 */
export function createD1TestDatabase(
  schema: string,
  options?: { onQuery?: () => void },
): D1Database {
  const sqlite = createSqliteFromSchema(schema)

  const database = {
    prepare: (query: string) => toPreparedStatement(sqlite, query, [], options?.onQuery),
    batch: async (statements: Array<D1PreparedStatement>) => {
      const transaction = sqlite.transaction((transactionStatements: Array<D1PreparedStatement>) =>
        transactionStatements.map((statement) => toPreparedStatementSync(statement).all()),
      )

      return transaction(statements)
    },
    exec: async (query: string) => {
      options?.onQuery?.()
      sqlite.exec(query)

      return { count: 0, duration: 0 }
    },
    dump: () => Promise.reject(new Error("dump is not supported in tests")),
    withSession: () => {
      throw new Error("withSession is not supported in tests")
    },
  }

  return castToD1Database(database)
}

function toPreparedStatement(
  sqlite: Database,
  query: string,
  values: ReadonlyArray<unknown>,
  onQuery?: () => void,
): D1PreparedStatement {
  const bindings = (): Array<SqliteBinding> => values.map(toSqliteBinding)

  const statement = {
    __openBedrockAllSync: () => {
      onQuery?.()
      return toResult(sqlite.query(query).all(...bindings()))
    },
    bind: (...next: Array<unknown>) => toPreparedStatement(sqlite, query, next, onQuery),
    first: async (column?: string) => {
      onQuery?.()
      const row = sqlite
        .query<Record<string, unknown>, Array<SqliteBinding>>(query)
        .get(...bindings())

      if (row === null) {
        return null
      }

      return column === undefined ? row : (row[column] ?? null)
    },
    run: async () => {
      onQuery?.()
      const result = sqlite.query(query).run(...bindings())
      return {
        results: [],
        success: true,
        meta: {
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          last_row_id: Number(result.lastInsertRowid),
          changed_db: result.changes > 0,
          changes: result.changes,
        },
      }
    },
    all: async () => {
      onQuery?.()
      return toResult(sqlite.query(query).all(...bindings()))
    },
    raw: async () => {
      onQuery?.()
      return sqlite.query(query).values(...bindings())
    },
  }

  return castToD1PreparedStatement(statement)
}

function toPreparedStatementSync(statement: D1PreparedStatement): {
  all: () => D1Result<unknown>
} {
  const maybeSync = statement as unknown as { __openBedrockAllSync?: () => D1Result<unknown> }

  if (maybeSync.__openBedrockAllSync === undefined) {
    throw new Error("test D1 batch received an unsupported prepared statement")
  }

  return { all: maybeSync.__openBedrockAllSync }
}

function toResult(rows: Array<unknown>) {
  return {
    results: rows,
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
      changes: 0,
    },
  }
}

type SqliteBinding = string | number | bigint | boolean | null | Uint8Array

function toSqliteBinding(value: unknown): SqliteBinding {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array
  ) {
    return value
  }

  return JSON.stringify(value)
}

/**
 * D1Database は abstract class のため構造的代入ができず、テストモックの境界で型アサーションが必要
 */
function castToD1Database(mock: Record<string, unknown>): D1Database {
  return mock as unknown as D1Database
}

/**
 * D1PreparedStatement は abstract class のため構造的代入ができず、テストモックの境界で型アサーションが必要
 */
function castToD1PreparedStatement(mock: Record<string, unknown>): D1PreparedStatement {
  return mock as unknown as D1PreparedStatement
}
