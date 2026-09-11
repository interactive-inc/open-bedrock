import { KnowledgeAuthorAuthorizationAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-author-authorization.adapter"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { CreateKnowledgeArticle } from "@/contexts/knowledge/application/create-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { createTestContext } from "@tests/api/support/create-test-context"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { ApplicationError, ForbiddenError, NotFoundError } from "@/lib/errors"
import type { KnowledgeContext as Context } from "@/contexts/knowledge/configuration/knowledge-context"

async function seedArticle(context: Context, authorId: number): Promise<KnowledgeArticle> {
  const result = await new CreateKnowledgeArticle(context).run({
    title: "Test Article",
    category: "engineering",
    tags: "test,article",
    bodyMd: "# Test\n\nBody text.",
    authorId: toWorkforceEmployeeId(authorId),
    commandId: "create:test",
    reason: "Initial instructions",
  })

  if (result instanceof Error) {
    throw new Error("seed failed")
  }

  return result
}

describe("CreateKnowledgeArticle", () => {
  test("creates a new knowledge article", async () => {
    const { context } = await authorFixture()

    const result = await new CreateKnowledgeArticle(context).run({
      title: "New Article",
      category: "general",
      tags: null,
      bodyMd: "Content here.",
      authorId: toWorkforceEmployeeId(1),
      commandId: "create:test",
      reason: "Initial instructions",
    })

    expect(result).toBeInstanceOf(KnowledgeArticle)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.title).toBe("New Article")
    expect(result.category).toBe("general")
    expect(result.tags).toBeNull()
    expect(result.authorId).toBe(toWorkforceEmployeeId(1))
  })

  test("creates an article with tags", async () => {
    const { context } = await authorFixture("2")

    const result = await new CreateKnowledgeArticle(context).run({
      title: "Tagged Article",
      category: "engineering",
      tags: "typescript,testing",
      bodyMd: "Content.",
      authorId: toWorkforceEmployeeId(2),
      commandId: "create:tagged",
      reason: "Initial instructions",
    })

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.tags).toBe("typescript,testing")
  })
})

describe("UpdateKnowledgeArticle", () => {
  test("updates the article for the author", async () => {
    const { context } = await authorFixture()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(context).run({
      expectedRevision: 1,
      commandId: "update:test",
      reason: "Reviewed change",
      articleId: article.id,
      authorId: toWorkforceEmployeeId(1),
      title: "Updated Title",
      category: "design",
      tags: "updated",
      bodyMd: "Updated body.",
    })

    expect(result).toBeInstanceOf(KnowledgeArticle)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.title).toBe("Updated Title")
    expect(result.category).toBe("design")
  })

  test("rejects update by non-author with not_author", async () => {
    const { context } = await authorFixture()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(context).run({
      expectedRevision: 1,
      commandId: "update:test",
      reason: "Reviewed change",
      articleId: article.id,
      authorId: toWorkforceEmployeeId(999),
      title: "Hacked",
      category: "hacked",
      tags: null,
      bodyMd: "Hacked body.",
    })

    expectApplicationError(result, ForbiddenError, "knowledge_author_forbidden")
  })

  test("rejects unknown id with article_not_found", async () => {
    const { context } = await authorFixture()

    const result = await new UpdateKnowledgeArticle(context).run({
      expectedRevision: 1,
      commandId: "update:test",
      reason: "Reviewed change",
      articleId: 9999,
      authorId: toWorkforceEmployeeId(1),
      title: "Ghost",
      category: "ghost",
      tags: null,
      bodyMd: "Ghost body.",
    })

    expectApplicationError(result, NotFoundError, "article_not_found")
  })
})

async function authorFixture(accountId = "1", now = new Date()) {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  await seedIamForEmployees(fixture.db)
  return {
    ...fixture,
    context: {
      ...fixture.context,
      var: {
        ...fixture.context.var,
        userId: accountId,
        now: () => now,
        bearerReadAuthentication: {
          accountId: zAccountId.parse(accountId),
          tokenVersion: 0,
          issuedAtMs: now.getTime() - 1000,
          expiresAtMs: Math.max(now.getTime(), Date.now()) + 60000,
          machineCredentialId: null,
          identityBindingId: null,
        },
      },
    },
  }
}

test("prepared knowledge authorization rejects account suspension before saving", async () => {
  const fixture = await authorFixture()
  const authorization = await new KnowledgeAuthorAuthorizationAdapter(fixture.context).prepare(
    toWorkforceEmployeeId(1),
  )
  if (authorization instanceof Error) throw authorization
  await fixture.db
    .prepare(
      "UPDATE system_accounts SET status='suspended',token_version=token_version+1 WHERE id='1'",
    )
    .run()
  const article = KnowledgeArticle.create({
    title: "Instructions",
    category: "Operations",
    tags: null,
    bodyMd: "Recorded text",
    authorId: toWorkforceEmployeeId(1),
    createdAt: authorization.now.toISOString(),
  })
  const saved = await new KnowledgeArticleRepository(fixture.context).createWithHistory(article, {
    actorAccountId: authorization.accountId,
    commandId: "revoked-before-save",
    reason: "Record procedure",
    requestJson: '{"operation":"create"}',
    at: authorization.now,
    assertions: authorization.assertions,
  })
  expect(saved).toBeInstanceOf(Error)
  expect(
    await fixture.db.prepare("SELECT count(*) AS n FROM knowledge_articles").first<number>("n"),
  ).toBe(0)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM knowledge_article_revisions")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await fixture.db
      .prepare("SELECT count(*) AS n FROM system_audit_events WHERE action='knowledge.create'")
      .first<number>("n"),
  ).toBe(0)
})

test("knowledge business-date guard rejects a prepared snapshot after its day ends", async () => {
  const fixture = await authorFixture("1", new Date(Date.now() - 48 * 60 * 60 * 1000))
  const authorization = await new KnowledgeAuthorAuthorizationAdapter(fixture.context).prepare(
    toWorkforceEmployeeId(1),
  )
  if (authorization instanceof Error) throw authorization
  const guard = authorization.assertions.at(-1)
  if (guard === undefined) throw new Error("business date guard missing")
  const failure = await fixture.db.batch([guard]).then(
    () => null,
    (error: unknown) => error,
  )
  expect(failure).toBeInstanceOf(Error)
  expect(failure instanceof Error ? failure.message : null).toContain(
    "knowledge_business_date_changed",
  )
})
