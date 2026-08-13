import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"
import { Database } from "bun:sqlite"

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'locked')),
    token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
  );

  CREATE TABLE system_sessions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
    family_id TEXT NOT NULL CHECK (length(family_id) BETWEEN 1 AND 255),
    token_hash TEXT NOT NULL CHECK (length(token_hash) BETWEEN 32 AND 512),
    token_version INTEGER NOT NULL CHECK (token_version >= 0),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
    rotated_at INTEGER CHECK (
      rotated_at IS NULL OR (rotated_at >= created_at AND rotated_at < expires_at)
    ),
    revoked_at INTEGER CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at AND (rotated_at IS NULL OR revoked_at >= rotated_at)
      )
    )
  );

  CREATE UNIQUE INDEX system_sessions_token_hash_uniq ON system_sessions (token_hash);
  CREATE INDEX system_sessions_account_idx ON system_sessions (account_id, created_at);
  CREATE INDEX system_sessions_active_family_idx
    ON system_sessions (family_id) WHERE revoked_at IS NULL;

  CREATE TRIGGER system_sessions_monotonic_lifecycle
  BEFORE UPDATE ON system_sessions
  WHEN
    NEW.id IS NOT OLD.id
    OR NEW.account_id IS NOT OLD.account_id
    OR NEW.family_id IS NOT OLD.family_id
    OR NEW.token_hash IS NOT OLD.token_hash
    OR NEW.token_version IS NOT OLD.token_version
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    OR (OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NOT OLD.rotated_at)
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
  BEGIN
    SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
  END;

  CREATE TABLE system_audit_events (
    event_id TEXT PRIMARY KEY NOT NULL CHECK (length(event_id) BETWEEN 1 AND 255),
    actor_account_id TEXT,
    action TEXT NOT NULL CHECK (length(action) BETWEEN 3 AND 200),
    target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 200),
    target_id TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
    reason_code TEXT,
    authorization_json TEXT,
    before_json TEXT,
    after_json TEXT,
    metadata_json TEXT,
    occurred_at INTEGER NOT NULL,
    CHECK (authorization_json IS NULL OR json_valid(authorization_json)),
    CHECK (before_json IS NULL OR json_valid(before_json)),
    CHECK (after_json IS NULL OR json_valid(after_json)),
    CHECK (metadata_json IS NULL OR json_valid(metadata_json))
  );

  CREATE TRIGGER system_audit_events_prevent_update
  BEFORE UPDATE ON system_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'system audit event is append-only');
  END;

  CREATE TRIGGER system_audit_events_prevent_delete
  BEFORE DELETE ON system_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'system audit event is append-only');
  END;
`

type SqliteBinding = string | number | bigint | boolean | null | Uint8Array

/** canonical System SessionのD1 transactionをBun SQLiteで検証するtest context。 */
export class SystemSessionTestContext {
  readonly sqlite = new Database(":memory:")
  readonly context: SystemD1Context
  private readonly statementExecutors = new WeakMap<object, () => D1Result<unknown>>()

  constructor() {
    this.sqlite.exec(schema)
    this.context = Object.freeze({ env: Object.freeze({ DB: this.toD1Database() }) })
    Object.freeze(this)
  }

  private toD1Database(): D1Database {
    const database = {
      prepare: (query: string) => this.toPreparedStatement(query, []),
      batch: async (statements: Array<D1PreparedStatement>) => {
        const transaction = this.sqlite.transaction(
          (transactionStatements: Array<D1PreparedStatement>) => {
            const databaseResults: Array<D1Result<unknown>> = []

            for (const statement of transactionStatements) {
              const execute = this.statementExecutors.get(statement)

              if (execute === undefined) {
                this.sqlite.query("SELECT json_extract('', '$')").all()
              } else {
                databaseResults.push(execute())
              }
            }

            return databaseResults
          },
        )

        return transaction(statements)
      },
      exec: async (query: string) => {
        this.sqlite.exec(query)

        return { count: 0, duration: 0 }
      },
    }

    // D1Databaseはabstract classのため、test adapter境界でのみ構造型を接続する。
    return database as unknown as D1Database
  }

  private toPreparedStatement(query: string, values: ReadonlyArray<unknown>): D1PreparedStatement {
    const bindings = values.map((value) => this.toSqliteBinding(value))
    const execute = () => this.toResult(this.sqlite.query(query).all(...bindings))
    const statement = {
      bind: (...nextValues: Array<unknown>) => this.toPreparedStatement(query, nextValues),
      first: async (column?: string) => {
        const row = this.sqlite
          .query<Record<string, unknown>, Array<SqliteBinding>>(query)
          .get(...bindings)

        if (row === null) return null

        return column === undefined ? row : (row[column] ?? null)
      },
      run: async () => {
        const databaseResult = this.sqlite.query(query).run(...bindings)

        return this.toResult([], Number(databaseResult.lastInsertRowid), databaseResult.changes)
      },
      all: async () => execute(),
      raw: async () => this.sqlite.query(query).values(...bindings),
    }

    // D1PreparedStatementもabstract classのため、test adapter境界でのみ構造型を接続する。
    const preparedStatement = statement as unknown as D1PreparedStatement
    this.statementExecutors.set(preparedStatement, execute)

    return preparedStatement
  }

  private toResult(rows: Array<unknown>, lastRowId = 0, changes = 0): D1Result<unknown> {
    return {
      results: rows,
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: changes,
        last_row_id: lastRowId,
        changed_db: changes > 0,
        changes,
      },
    }
  }

  private toSqliteBinding(value: unknown): SqliteBinding {
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
}
