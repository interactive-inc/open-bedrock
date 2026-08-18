import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { refreshTokens } from "@/contexts/system-compatibility/infrastructure/schema/system"
import { describe, expect, test } from "bun:test"
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")
const activeFamilyMigrationFile = "0018_refresh_token_active_family_index.sql"
const activeFamilyMigrationPath = join(migrationsDirectory, activeFamilyMigrationFile)
const activeFamilyIndexName = "idx_refresh_tokens_active_family"

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
}

function schemaBeforeActiveFamilyIndex(): string {
  return migrationFiles()
    .filter((file) => file < activeFamilyMigrationFile)
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")
}

async function activeFamilyPlan(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `EXPLAIN QUERY PLAN
       SELECT id
       FROM refresh_tokens
       WHERE family_id = ?1 AND revoked_at IS NULL`,
    )
    .bind("query-plan-family")
    .all<{ detail: string }>()

  return result.results.map(({ detail }) => detail)
}

function expectActiveFamilyIndex(plan: string[]): void {
  expect(plan.join("\n")).toMatch(
    new RegExp(
      `SEARCH refresh_tokens USING (?:COVERING )?INDEX ${activeFamilyIndexName} \\(family_id=\\?\\)`,
    ),
  )
  expect(plan.some((detail) => detail.includes("SCAN refresh_tokens"))).toBe(false)
}

describe("refresh token active-family index migration", () => {
  test("keeps numeric migrations continuous through the forward 0018 migration", () => {
    const numbered = migrationFiles().filter((file) => /^\d{4}_.+\.sql$/.test(file))

    expect(numbered.map((file) => file.slice(0, 4))).toEqual(
      Array.from({ length: numbered.length }, (_, index) => String(index + 1).padStart(4, "0")),
    )
    expect(numbered.slice(16, 18)).toEqual([
      "0017_audit_batch_decisions.sql",
      activeFamilyMigrationFile,
    ])
  })

  test("keeps the partial active-family index synchronized in the Drizzle schema", () => {
    const index = getTableConfig(refreshTokens).indexes.find(
      ({ config }) => config.name === activeFamilyIndexName,
    )

    const predicate = index?.config.where
    const predicateSql =
      predicate === undefined ? undefined : new SQLiteSyncDialect().sqlToQuery(predicate).sql

    expect(index?.config.columns).toEqual([refreshTokens.familyId])
    expect(index?.config.unique).toBe(false)
    expect(predicateSql).toBe("revoked_at IS NULL")
  })

  test("uses the partial active-family index in a fresh schema", async () => {
    const db = createD1TestDatabase(loadSchema())

    expectActiveFamilyIndex(await activeFamilyPlan(db))
  })

  test("upgrades an existing database without changing rows and replaces the full scan", async () => {
    const db = createD1TestDatabase(schemaBeforeActiveFamilyIndex())
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (901, 'E901', 'Query Plan Worker', 'active');
      INSERT INTO accounts
        (id, employee_id, status, token_version, created_at, updated_at)
      VALUES (901, 901, 'active', 0, 1767225500, 1767225500);
      INSERT INTO refresh_tokens
        (id, account_id, token_hash, family_id, token_version, expires_at,
         revoked_at, user_agent, created_at)
      VALUES
        (901, 901, 'active-hash', 'query-plan-family', 0, 1767229200,
         NULL, 'fixture-agent', 1767225500),
        (902, 901, 'revoked-hash', 'query-plan-family', 0, 1767229200,
         1767225600, 'fixture-agent', 1767225500);
    `)

    expect(
      (await activeFamilyPlan(db)).some((detail) => detail.includes("SCAN refresh_tokens")),
    ).toBe(true)
    expect(existsSync(activeFamilyMigrationPath)).toBe(true)
    if (!existsSync(activeFamilyMigrationPath)) return

    const migration = readFileSync(activeFamilyMigrationPath, "utf8")
    expect(migration).toContain(`CREATE INDEX ${activeFamilyIndexName}`)
    expect(migration).toContain("ON refresh_tokens (family_id)")
    expect(migration).toContain("WHERE revoked_at IS NULL")
    await db.exec(migration)

    expect(
      (
        await db
          .prepare(
            `SELECT id, revoked_at
             FROM refresh_tokens
             WHERE family_id = ?1
             ORDER BY id`,
          )
          .bind("query-plan-family")
          .all<{ id: number; revoked_at: number | null }>()
      ).results,
    ).toEqual([
      { id: 901, revoked_at: null },
      { id: 902, revoked_at: 1767225600 },
    ])
    expect(
      (
        await db
          .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?1")
          .bind(activeFamilyIndexName)
          .first<string>("sql")
      )
        ?.replace(/\s+/g, " ")
        .trim(),
    ).toBe(
      `CREATE INDEX ${activeFamilyIndexName} ON refresh_tokens (family_id) WHERE revoked_at IS NULL`,
    )
    expectActiveFamilyIndex(await activeFamilyPlan(db))
  })
})
