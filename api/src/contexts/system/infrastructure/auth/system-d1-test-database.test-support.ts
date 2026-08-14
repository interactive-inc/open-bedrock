import { Database } from "bun:sqlite"

type Options = Readonly<{
  onQuery?: () => void
}>

/** Bun SQLiteをportable System infrastructure test向けのD1境界へ適応する。 */
export function createSystemD1TestDatabase(schema: string, options?: Options): D1Database {
  const sqlite = new Database(":memory:")

  sqlite.exec(schema)

  return wrapSystemD1TestDatabase(sqlite, options)
}

/** 既存のBun SQLite fixtureへportable System test用のD1境界を載せる。 */
export function wrapSystemD1TestDatabase(sqlite: Database, options?: Options): D1Database {
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
    __systemAllSync: () => {
      onQuery?.()
      return toResult(sqlite.query(query).all(...bindings()))
    },
    bind: (...next: Array<unknown>) => toPreparedStatement(sqlite, query, next, onQuery),
    first: async (column?: string) => {
      onQuery?.()
      const row = sqlite
        .query<Record<string, unknown>, Array<SqliteBinding>>(query)
        .get(...bindings())

      if (row === null) return null

      return column === undefined ? row : (row[column] ?? null)
    },
    run: async () => {
      onQuery?.()
      const result = sqlite.query(query).run(...bindings())

      return toResult([], Number(result.lastInsertRowid), result.changes)
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
  const maybeSync = statement as unknown as SynchronousD1TestStatement

  if (maybeSync.__systemAllSync === undefined) {
    throw new Error("System test D1 batch received an unsupported prepared statement")
  }

  return { all: maybeSync.__systemAllSync }
}

type SynchronousD1TestStatement = Readonly<{
  __systemAllSync?: () => D1Result<unknown>
}>

function toResult(rows: Array<unknown>, lastRowId = 0, changes = 0): D1Result<unknown> {
  return {
    results: rows,
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: rows.length,
      rows_written: changes,
      last_row_id: lastRowId,
      changed_db: changes > 0,
      changes,
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

/** D1Databaseはabstract classのため、test adapter境界でのみ構造型を接続する。 */
function castToD1Database(mock: Record<string, unknown>): D1Database {
  return mock as unknown as D1Database
}

/** D1PreparedStatementはabstract classのため、test adapter境界でのみ構造型を接続する。 */
function castToD1PreparedStatement(mock: Record<string, unknown>): D1PreparedStatement {
  return mock as unknown as D1PreparedStatement
}
