import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"

test("migration preserves the existing text without inventing an editor or past revision time", async () => {
  const migrations = join(import.meta.dir, "../../../../migrations")
  const baseline = readdirSync(migrations)
    .filter((name) => name.endsWith(".sql") && name < "0178_")
    .sort()
    .map((name) => readFileSync(join(migrations, name), "utf8"))
    .join("\n")
  const db = createD1TestDatabase(baseline)
  await seedCompanyEmployees(db, [{ id: 1, code: "E001", name: "Example Employee" }])
  await db
    .prepare(`INSERT INTO knowledge_articles
    (id,title,category,tags,body_md,author_id,created_at)
    VALUES (1,'Procedure','Operations',NULL,'Known current text','1','2020-01-01T00:00:00Z')`)
    .run()
  await db.exec(
    readFileSync(join(migrations, "0178_record_knowledge_article_revisions.sql"), "utf8"),
  )

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
  expect(KnowledgeArticle.restore(JSON.parse(revision?.snapshot_json ?? "null"))).toMatchObject({
    id: 1,
    revision: 1,
    status: "active",
    bodyMd: "Known current text",
    authorId: "1",
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
