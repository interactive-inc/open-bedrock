import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { expect, test } from "bun:test"
import { createTestContext } from "@tests/api/support/create-test-context"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"

test("knowledge revision append preserves replay, rejects stale edits and rolls back an audit failure", async () => {
  const f = await createTestContext()
  await seedIamForEmployees(f.db)
  await f.db
    .prepare(`INSERT INTO knowledge_articles (id,title,category,tags,body_md,author_id,created_at)
    VALUES (1,'Procedure','Operations',NULL,'Original',?1,'2026-01-01T00:00:00Z')`)
    .bind(toWorkforceEmployeeId(1))
    .run()
  const repository = new KnowledgeArticleRepository(f.context)
  const original = await repository.findById(1)
  if (original === null || original instanceof Error) throw new Error("fixture missing")
  const updated = original.withContent({
    title: "Procedure",
    category: "Operations",
    tags: null,
    bodyMd: "Reviewed",
  })
  const input = {
    expectedRevision: 1,
    actorAccountId: "1",
    commandId: "knowledge:first",
    reason: "Review complete",
    requestJson: JSON.stringify({ body: "Reviewed", expectedRevision: 1 }),
    at: new Date(),
    assertions: [
      f.db.prepare(
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM system_accounts WHERE id='1' AND status='active') THEN 1 ELSE json_extract('{}','actor_inactive') END",
      ),
    ],
  }
  const saved = await repository.appendRevision(updated, input)
  if (saved instanceof Error) throw saved
  expect(saved).toEqual(updated)
  expect(await repository.appendRevision(updated, input)).toEqual(updated)
  expect(
    await repository.appendRevision(updated, { ...input, requestJson: '{"different":true}' }),
  ).toBeNull()
  expect(
    await repository.appendRevision(updated, { ...input, commandId: "knowledge:stale" }),
  ).toBeNull()
  expect(
    await f.db.prepare("SELECT count(*) AS n FROM knowledge_article_revisions").first<number>("n"),
  ).toBe(1)
  const withdrawn = updated.withdraw()
  await f.db.exec(`CREATE TRIGGER reject_knowledge_audit BEFORE INSERT ON system_audit_events
    WHEN NEW.action='knowledge.withdraw' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;`)
  const withdrawal = {
    ...input,
    expectedRevision: 2,
    commandId: "knowledge:withdraw",
    requestJson: '{"withdraw":2}',
  }
  expect(await repository.appendRevision(withdrawn, withdrawal)).toBeInstanceOf(Error)
  expect(
    await f.db.prepare("SELECT status FROM knowledge_articles WHERE id=1").first<string>("status"),
  ).toBe("active")
  expect(
    await f.db.prepare("SELECT count(*) AS n FROM knowledge_article_revisions").first<number>("n"),
  ).toBe(1)
  await f.db.exec("DROP TRIGGER reject_knowledge_audit")
  await f.db.exec(`CREATE TRIGGER corrupt_knowledge_after_audit AFTER INSERT ON system_audit_events
    WHEN NEW.action='knowledge.withdraw' BEGIN UPDATE knowledge_articles SET body_md='Corrupted' WHERE id=1; END;`)
  expect(await repository.appendRevision(withdrawn, withdrawal)).toBeInstanceOf(Error)
  expect(
    await f.db
      .prepare("SELECT body_md FROM knowledge_articles WHERE id=1")
      .first<string>("body_md"),
  ).toBe("Reviewed")
  await f.db.exec("DROP TRIGGER corrupt_knowledge_after_audit")
  expect(await repository.appendRevision(withdrawn, withdrawal)).toEqual(withdrawn)
  expect(
    await f.db
      .prepare("SELECT body_md FROM knowledge_articles WHERE id=1")
      .first<string>("body_md"),
  ).toBe("Reviewed")
  expect(await repository.readRecordedCommand(input)).toEqual({
    article: updated,
    requestJson: input.requestJson,
  })
  expect(await repository.readRecordedCommand({ ...input, assertions: [] })).toBeInstanceOf(Error)
  expect(
    await repository.readRecordedCommand({
      ...input,
      assertions: [f.db.prepare("SELECT json_extract('{}','authorization_revoked')")],
    }),
  ).toBeInstanceOf(Error)
  expect(await repository.readRecordedCommand({ ...input, actorAccountId: "other" })).toBeNull()
})

test("knowledge creation saves its first revision and audit atomically and preserves retry identity", async () => {
  const fixture = await createTestContext()
  await seedIamForEmployees(fixture.db)
  const repository = new KnowledgeArticleRepository(fixture.context)
  const article = KnowledgeArticle.create({
    title: "New instructions",
    category: "Operations",
    tags: null,
    bodyMd: "Original text",
    authorId: toWorkforceEmployeeId(1),
    createdAt: new Date().toISOString(),
  })
  const input = {
    actorAccountId: "1",
    commandId: "create:knowledge",
    reason: "New procedure",
    requestJson: '{"operation":"create"}',
    at: new Date(),
    assertions: [fixture.db.prepare("SELECT 1")],
  }
  await fixture.db.exec(
    "CREATE TRIGGER reject_initial_knowledge_audit BEFORE INSERT ON system_audit_events WHEN NEW.action='knowledge.create' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;",
  )
  expect(await repository.createWithHistory(article, input)).toBeInstanceOf(Error)
  expect(
    await fixture.db.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(0)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM knowledge_article_revisions")
      .first<number>("n"),
  ).toBe(0)
  await fixture.db.exec("DROP TRIGGER reject_initial_knowledge_audit")
  const created = await repository.createWithHistory(article, input)
  if (created === null || created instanceof Error)
    throw new Error("creation failed", { cause: created })
  expect(created.revision).toBe(1)
  expect(await repository.createWithHistory(article, input)).toEqual(created)
  expect(
    await repository.createWithHistory(article, { ...input, requestJson: '{"different":true}' }),
  ).toBeNull()
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM knowledge_article_revisions")
      .first<number>("n"),
  ).toBe(1)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM system_audit_events WHERE action='knowledge.create'")
      .first<number>("n"),
  ).toBe(1)
})

test("concurrent knowledge creation preserves separate commands and deduplicates the same command", async () => {
  const fixture = await createTestContext()
  await seedIamForEmployees(fixture.db)
  const repository = new KnowledgeArticleRepository(fixture.context)
  const article = KnowledgeArticle.create({
    title: "Concurrent instructions",
    category: "Operations",
    tags: null,
    bodyMd: "Recorded text",
    authorId: toWorkforceEmployeeId(1),
    createdAt: new Date().toISOString(),
  })
  const input = {
    actorAccountId: "1",
    commandId: "concurrent:first",
    reason: "Record instructions",
    requestJson: '{"operation":"create"}',
    at: new Date(),
    assertions: [fixture.db.prepare("SELECT 1")],
  }
  const created = await Promise.all([
    repository.createWithHistory(article, input),
    repository.createWithHistory(article, { ...input, commandId: "concurrent:second" }),
  ])
  for (const result of created) expect(result).toBeInstanceOf(KnowledgeArticle)
  expect(created[0]).not.toEqual(created[1])
  const duplicate = await Promise.all([
    repository.createWithHistory(article, { ...input, commandId: "concurrent:duplicate" }),
    repository.createWithHistory(article, { ...input, commandId: "concurrent:duplicate" }),
  ])
  expect(duplicate[0]).toBeInstanceOf(KnowledgeArticle)
  expect(duplicate[0]).toEqual(duplicate[1])
  expect(
    await fixture.db.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(3)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM knowledge_article_revisions")
      .first<number>("n"),
  ).toBe(3)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM system_audit_events WHERE action='knowledge.create'")
      .first<number>("n"),
  ).toBe(3)
  const revoked = {
    ...input,
    commandId: "concurrent:revoked",
    assertions: [fixture.db.prepare("SELECT json_extract('{}','authorization_revoked')")],
  }
  expect(await repository.createWithHistory(article, revoked)).toBeInstanceOf(Error)
  expect(
    await fixture.db.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(3)
})
