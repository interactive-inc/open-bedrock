import { Database } from "bun:sqlite"

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

class SqliteD1Statement {
  constructor(
    private readonly database: Database,
    private readonly sql: string,
    private readonly values: ReadonlyArray<unknown> = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteD1Statement(this.database, this.sql, values) as unknown as D1PreparedStatement
  }

  async first<T>(column?: string): Promise<T | null> {
    const values = this.values.map(toSqliteBinding)
    const row = this.database
      .query<Record<string, unknown>, SqliteBinding[]>(this.sql)
      .get(...values)
    if (row === null) return null
    return (column === undefined ? row : (row[column] ?? null)) as T | null
  }

  async all<T>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: this.database
        .query<T, SqliteBinding[]>(this.sql)
        .all(...this.values.map(toSqliteBinding)),
      meta: {},
    } as D1Result<T>
  }

  async run(): Promise<D1Result> {
    return this.execute()
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    return this.database.query(this.sql).values(...this.values.map(toSqliteBinding)) as T[]
  }

  execute(): D1Result {
    if (/^(?:SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(this.sql.trimStart())) {
      return {
        success: true,
        results: this.database.query(this.sql).all(...this.values.map(toSqliteBinding)),
        meta: {},
      } as D1Result
    }
    const result = this.database.query(this.sql).run(...this.values.map(toSqliteBinding))
    return {
      success: true,
      results: [],
      meta: { changes: result.changes },
    } as unknown as D1Result
  }
}

/** canonical Company integration testが両製品で共有する最小D1 adapter。 */
export function createCompanyD1TestDatabase(schemaSql: string): D1Database {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec(schemaSql)

  const database = {
    prepare(sql: string): D1PreparedStatement {
      return new SqliteD1Statement(sqlite, sql) as unknown as D1PreparedStatement
    },
    async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
      return sqlite.transaction(() =>
        statements.map((statement) => (statement as unknown as SqliteD1Statement).execute()),
      )()
    },
    async exec(sql: string): Promise<D1ExecResult> {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  }

  return database as unknown as D1Database
}
