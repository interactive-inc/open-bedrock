import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")
const backfillMigration = readFileSync(
  join(migrationsDirectory, "0127_system_account_backfill.sql"),
  "utf8",
)

const openDatabases: Array<Database> = []

type AccountState = {
  id: string
  status: string
  tokenVersion: number
  createdAt: number
  updatedAt: number
}

function createLegacyDatabase(): Database {
  const database = new Database(":memory:")
  const schema = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < "0127_system_account_backfill.sql")
    .sort()
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")

  database.exec(schema)
  database.exec("PRAGMA foreign_keys = ON")
  openDatabases.push(database)
  return database
}

function insertLegacyAccount(
  database: Database,
  props: {
    id: number
    status: "active" | "suspended" | "locked"
    tokenVersion: number
    createdAt: number
    updatedAt: number
  },
): void {
  database.run(
    `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [props.id, props.status, props.tokenVersion, props.createdAt, props.updatedAt],
  )
}

function applyBackfill(database: Database): void {
  const statements = backfillMigration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "")

  database.transaction(() => {
    for (const statement of statements) {
      database.exec(statement)
    }
  })()
}

function canonicalAccounts(database: Database): ReadonlyArray<AccountState> {
  return database
    .query<AccountState, []>(
      `SELECT
         id,
         status,
         token_version AS tokenVersion,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM system_accounts
       ORDER BY id`,
    )
    .all()
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    database.close()
  }
})

describe("0127 canonical System Account backfill", () => {
  test("Wranglerのstatement分割境界をmigration内に固定する", () => {
    expect(backfillMigration.match(/--> statement-breakpoint/g)).toHaveLength(10)
    expect(
      backfillMigration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    ).toHaveLength(10)
  })

  test("active・suspended・lockedをdigit-only opaque IDと全security state付きで投影する", () => {
    const database = createLegacyDatabase()
    insertLegacyAccount(database, {
      id: 1,
      status: "active",
      tokenVersion: 0,
      createdAt: 100,
      updatedAt: 100,
    })
    insertLegacyAccount(database, {
      id: 2,
      status: "suspended",
      tokenVersion: 3,
      createdAt: 200,
      updatedAt: 300,
    })
    insertLegacyAccount(database, {
      id: 3,
      status: "locked",
      tokenVersion: 5,
      createdAt: 400,
      updatedAt: 500,
    })

    applyBackfill(database)

    expect(canonicalAccounts(database)).toEqual([
      { id: "1", status: "active", tokenVersion: 0, createdAt: 100, updatedAt: 100 },
      { id: "2", status: "suspended", tokenVersion: 3, createdAt: 200, updatedAt: 300 },
      { id: "3", status: "locked", tokenVersion: 5, createdAt: 400, updatedAt: 500 },
    ])
    expect(
      database
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM sqlite_master
           WHERE type = 'trigger' AND name LIKE 'system_accounts_legacy_accounts_%'`,
        )
        .get(),
    ).toEqual({ count: 6 })
    expect(
      database
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM sqlite_master
           WHERE type = 'table' AND name = 'system_account_backfill_validation'`,
        )
        .get(),
    ).toEqual({ count: 0 })
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  })

  test("完全一致する既存projectionは受理し、不一致ならmigration全体をrollbackする", () => {
    const matching = createLegacyDatabase()
    insertLegacyAccount(matching, {
      id: 7,
      status: "active",
      tokenVersion: 2,
      createdAt: 100,
      updatedAt: 200,
    })
    matching.run(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('7', 'active', 2, 100, 200)`,
    )

    applyBackfill(matching)
    expect(canonicalAccounts(matching)).toEqual([
      { id: "7", status: "active", tokenVersion: 2, createdAt: 100, updatedAt: 200 },
    ])

    const mismatching = createLegacyDatabase()
    insertLegacyAccount(mismatching, {
      id: 8,
      status: "active",
      tokenVersion: 2,
      createdAt: 100,
      updatedAt: 200,
    })
    mismatching.run(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('8', 'suspended', 3, 100, 201)`,
    )

    expect(
      mismatching
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM accounts legacy
           LEFT JOIN system_accounts canonical ON canonical.id = CAST(legacy.id AS TEXT)
           WHERE canonical.status IS NOT legacy.status`,
        )
        .get(),
    ).toEqual({ count: 1 })

    expect(() => applyBackfill(mismatching)).toThrow()
    expect(canonicalAccounts(mismatching)).toEqual([
      { id: "8", status: "suspended", tokenVersion: 3, createdAt: 100, updatedAt: 201 },
    ])
    expect(
      mismatching
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM sqlite_master
           WHERE type = 'trigger' AND name LIKE 'system_accounts_legacy_accounts_%'`,
        )
        .get(),
    ).toEqual({ count: 0 })
  })

  test("legacy integer IDはdigit-only opaque IDへ写せる値だけを受理する", () => {
    const existing = createLegacyDatabase()
    insertLegacyAccount(existing, {
      id: -1,
      status: "active",
      tokenVersion: 0,
      createdAt: 100,
      updatedAt: 100,
    })

    expect(() => applyBackfill(existing)).toThrow()
    expect(canonicalAccounts(existing)).toEqual([])

    const inserted = createLegacyDatabase()
    applyBackfill(inserted)
    expect(() =>
      insertLegacyAccount(inserted, {
        id: -1,
        status: "active",
        tokenVersion: 0,
        createdAt: 100,
        updatedAt: 100,
      }),
    ).toThrow()
    expect(canonicalAccounts(inserted)).toEqual([])
  })

  test("legacy insert・status transition・token invalidation・deleteを同一transactionで同期する", () => {
    const database = createLegacyDatabase()
    applyBackfill(database)

    insertLegacyAccount(database, {
      id: 11,
      status: "active",
      tokenVersion: 0,
      createdAt: 100,
      updatedAt: 100,
    })
    database.run(
      `UPDATE accounts
       SET status = 'suspended', token_version = 1, updated_at = 200
       WHERE id = 11`,
    )
    database.run(
      `UPDATE accounts
       SET token_version = 2, updated_at = 300
       WHERE id = 11`,
    )

    expect(canonicalAccounts(database)).toEqual([
      { id: "11", status: "suspended", tokenVersion: 2, createdAt: 100, updatedAt: 300 },
    ])

    database.run("DELETE FROM accounts WHERE id = 11")
    expect(canonicalAccounts(database)).toEqual([])
  })

  test("identity mutation・statusだけの変更・tokenと時刻の逆行をfail closedにする", () => {
    const database = createLegacyDatabase()
    insertLegacyAccount(database, {
      id: 20,
      status: "active",
      tokenVersion: 2,
      createdAt: 100,
      updatedAt: 200,
    })
    applyBackfill(database)

    expect(() => database.run("UPDATE accounts SET id = 21 WHERE id = 20")).toThrow()
    expect(() => database.run("UPDATE accounts SET created_at = 99 WHERE id = 20")).toThrow()
    expect(() =>
      database.run("UPDATE accounts SET status = 'locked', updated_at = 201 WHERE id = 20"),
    ).toThrow()
    expect(() =>
      database.run("UPDATE accounts SET token_version = 1, updated_at = 201 WHERE id = 20"),
    ).toThrow()
    expect(() => database.run("UPDATE accounts SET updated_at = 199 WHERE id = 20")).toThrow()

    expect(canonicalAccounts(database)).toEqual([
      { id: "20", status: "active", tokenVersion: 2, createdAt: 100, updatedAt: 200 },
    ])
  })

  test("canonical欠損またはdivergenceがあればlegacy security updateとdeleteを拒否する", () => {
    const missing = createLegacyDatabase()
    insertLegacyAccount(missing, {
      id: 30,
      status: "active",
      tokenVersion: 0,
      createdAt: 100,
      updatedAt: 100,
    })
    applyBackfill(missing)
    missing.run("DELETE FROM system_accounts WHERE id = '30'")

    expect(() =>
      missing.run("UPDATE accounts SET token_version = 1, updated_at = 200 WHERE id = 30"),
    ).toThrow()
    expect(() => missing.run("DELETE FROM accounts WHERE id = 30")).toThrow()

    const divergent = createLegacyDatabase()
    insertLegacyAccount(divergent, {
      id: 31,
      status: "active",
      tokenVersion: 0,
      createdAt: 100,
      updatedAt: 100,
    })
    applyBackfill(divergent)
    divergent.run(
      `UPDATE system_accounts
       SET status = 'locked', token_version = 1, updated_at = 200
       WHERE id = '31'`,
    )

    expect(() =>
      divergent.run(
        `UPDATE accounts
         SET status = 'suspended', token_version = 1, updated_at = 200
         WHERE id = 31`,
      ),
    ).toThrow()
    expect(() => divergent.run("DELETE FROM accounts WHERE id = 31")).toThrow()
  })
})
