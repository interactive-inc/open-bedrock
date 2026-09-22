import { Database } from "bun:sqlite"
import { createCompanySqliteTestDatabaseTemplate } from "@/contexts/company/test/create-company-sqlite-test-database-template.test-support"

// 全 migration 級だけを複製する。32 KiB 相当の文字数未満のインライン SQL は通常 1 ms 未満。
const SCHEMA_CACHE_MIN_LENGTH = 32 * 1024
// 全 migration の serialize は約 5 MB。variant が増えても約 40 MB 分までに抑える。
const SCHEMA_CACHE_MAX_ENTRIES = 8
const schemaTemplates = new Map<
  string,
  ReturnType<typeof createCompanySqliteTestDatabaseTemplate>
>()

function createSqliteDatabase(schemaSql: string): Database {
  if (schemaSql.length >= SCHEMA_CACHE_MIN_LENGTH) {
    const template =
      schemaTemplates.get(schemaSql) ?? createCompanySqliteTestDatabaseTemplate(schemaSql)
    // Map の挿入順を利用し、hit した schema も最新へ移す。適用に失敗した SQL は登録しない。
    schemaTemplates.delete(schemaSql)
    schemaTemplates.set(schemaSql, template)
    if (schemaTemplates.size > SCHEMA_CACHE_MAX_ENTRIES) {
      const oldest = schemaTemplates.keys().next().value
      if (oldest !== undefined) schemaTemplates.delete(oldest)
    }
    return template.createDatabase()
  }

  const sqlite = new Database(":memory:")
  try {
    sqlite.exec("PRAGMA foreign_keys = ON")
    sqlite.exec(schemaSql)
    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
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
export function createCompanyD1TestDatabase(source: string | Database): D1Database {
  const sqlite = typeof source === "string" ? createSqliteDatabase(source) : source

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
