import { Database } from "bun:sqlite"

// テスト用: bun:sqlite を D1Database 互換インターフェースで包む。
// 本番は Cloudflare D1。テストはこのインメモリ SQLite を env.DB に注入する。
// D1 の型（abstract class）を別実装で満たす境界アダプタのため、最小限の型アサーションを使う。
export function createD1TestDatabase(schema: string): D1Database {
  const sqlite = new Database(":memory:")

  sqlite.exec(schema)

  const database = {
    prepare: (query: string) => toPreparedStatement(sqlite, query, []),
    batch: async (statements: Array<D1PreparedStatement>) => {
      const results = []

      for (const statement of statements) {
        results.push(await statement.all())
      }

      return results
    },
    exec: async (query: string) => {
      sqlite.exec(query)

      return { count: 0, duration: 0 }
    },
    dump: () => Promise.reject(new Error("dump is not supported in tests")),
    withSession: () => {
      throw new Error("withSession is not supported in tests")
    },
  }

  return database as unknown as D1Database
}

function toPreparedStatement(
  sqlite: Database,
  query: string,
  values: ReadonlyArray<unknown>,
): D1PreparedStatement {
  const bindings = (): Array<SqliteBinding> => values.map(toSqliteBinding)

  const statement = {
    bind: (...next: Array<unknown>) => toPreparedStatement(sqlite, query, next),
    first: async (column?: string) => {
      const row = sqlite.query(query).get(...bindings()) as Record<string, unknown> | null

      if (row === null) {
        return null
      }

      return column === undefined ? row : (row[column] ?? null)
    },
    run: async () => toResult(sqlite.query(query).all(...bindings())),
    all: async () => toResult(sqlite.query(query).all(...bindings())),
    raw: async () => sqlite.query(query).values(...bindings()),
  }

  return statement as unknown as D1PreparedStatement
}

function toResult(rows: Array<unknown>) {
  return {
    results: rows,
    success: true as const,
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
