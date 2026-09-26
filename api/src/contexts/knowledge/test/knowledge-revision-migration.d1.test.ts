import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const migrations = join(import.meta.dir, "../../../../migrations")

let local: LocalD1

// 独立したローカルD1へ0178より前のmigrationを適用するため、数秒かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ empty: ["revision-migration"] })
})

afterAll(async () => {
  await local.dispose()
})

/** migrationファイルを、本番の適用と同じくファイル単位のbatchで適用する。 */
async function applyMigrationFile(db: D1Database, name: string): Promise<void> {
  const statements = splitSqlStatements(readFileSync(join(migrations, name), "utf8"))
  if (statements.length === 0) return
  await db.batch(statements.map((statement) => db.prepare(statement)))
}

test("migration preserves the existing text without inventing an editor or past revision time", async () => {
  const db = await local.database("revision-migration")
  const baseline = readdirSync(migrations)
    .filter((name) => name.endsWith(".sql") && name < "0178_")
    .sort()
  for (const name of baseline) await applyMigrationFile(db, name)
  await seedCompanyEmployees(db, [{ id: 1, code: "E001", name: "Example Employee" }])
  await db
    .prepare(`INSERT INTO knowledge_articles
    (id,title,category,tags,body_md,author_id,created_at)
    VALUES (1,'Procedure','Operations',NULL,'Known current text',?1,'2020-01-01T00:00:00Z')`)
    .bind(testEmployeeId(1))
    .run()
  await applyMigrationFile(db, "0178_record_knowledge_article_revisions.sql")

  const revision = await db
    .prepare("SELECT * FROM knowledge_article_revisions WHERE article_id=1")
    .first<{
      snapshot_json: string
      source: string
      actor_account_id: string | null
      recorded_at: number
    }>()
  expect(revision?.source).toBe("existing_record")
  expect(revision?.actor_account_id).toBeNull()
  expect(revision?.recorded_at).toBeGreaterThan(Date.parse("2020-01-01T00:00:00Z"))
  // 0178 は主キーが整数だった頃の本文を記録する。後の移行でも本文は書き換えない。
  expect(JSON.parse(revision?.snapshot_json ?? "null")).toMatchObject({
    id: 1,
    revision: 1,
    status: "active",
    bodyMd: "Known current text",
    authorId: testEmployeeId(1),
    createdAt: "2020-01-01T00:00:00Z",
  })
  for (const command of [
    {
      sql: "UPDATE knowledge_article_revisions SET reason='Rewritten'",
      error: "knowledge_revision_immutable",
    },
    { sql: "DELETE FROM knowledge_article_revisions", error: "knowledge_revision_immutable" },
    {
      sql: "DELETE FROM knowledge_articles WHERE id=1",
      error: "knowledge_article_withdrawal_required",
    },
  ]) {
    const failure = await db
      .prepare(command.sql)
      .run()
      .then(
        () => null,
        (error: unknown) => error,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(failure instanceof Error ? failure.message : null).toContain(command.error)
  }
})
