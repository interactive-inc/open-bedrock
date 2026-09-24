import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CreateKnowledgeArticle } from "@/contexts/knowledge/application/create-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { KnowledgeAuthorAuthorizationAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-author-authorization.adapter"
import { KnowledgeArticleRepository } from "@/contexts/knowledge/infrastructure/repositories/knowledge-article.repository"
import { ApplicationError, ForbiddenError } from "@/lib/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["compose", "suspended", "business-date"] })
})

afterAll(async () => {
  await local.dispose()
})

/** 作成者のbearer認証を載せたContextをローカルD1上に作る。 */
async function authorFixture(name: string, accountId = "1", now = new Date()) {
  const fixture = await createLocalD1Context(local, name, { withCompanyOrganization: true })
  await seedIamForEmployees(fixture.db)
  const context = {
    ...fixture.context,
    var: {
      ...fixture.context.var,
      userId: zAccountId.parse(accountId),
      accountTokenVersion: 0,
      permissions: new Set<string>(),
      role: "authenticated",
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
  }
  return {
    ...fixture,
    context,
    ports: {
      articleRepository: new KnowledgeArticleRepository(context),
      authorAuthorization: new KnowledgeAuthorAuthorizationAdapter(context),
    },
  }
}

describe("knowledge article persistence on local D1", () => {
  test("creates and revises an article through the real authorization and repository", async () => {
    const fixture = await authorFixture("compose")

    const created = await new CreateKnowledgeArticle(fixture.ports).run({
      title: "Tagged Article",
      category: "engineering",
      tags: "typescript,testing",
      bodyMd: "Content.",
      authorId: toWorkforceEmployeeId(1),
      commandId: "create:test",
      reason: "Initial instructions",
    })

    if (created instanceof Error || created.id === null) throw new Error("create failed")

    expect(created.tags).toBe("typescript,testing")
    expect(created.authorId).toBe(toWorkforceEmployeeId(1))

    const updated = await new UpdateKnowledgeArticle(fixture.ports).run({
      expectedRevision: 1,
      commandId: "update:test",
      reason: "Reviewed change",
      articleId: created.id,
      authorId: toWorkforceEmployeeId(1),
      title: "Updated Title",
      category: "design",
      tags: "updated",
      bodyMd: "Updated body.",
    })

    if (updated instanceof ApplicationError) throw new Error("update failed")

    expect(updated.title).toBe("Updated Title")
    expect(updated.category).toBe("design")

    // 認証中のAccountと対応しない従業員を作成者として名乗る更新は、認可Adapterが拒否する。
    const forbidden = await new UpdateKnowledgeArticle(fixture.ports).run({
      expectedRevision: 2,
      commandId: "update:forbidden",
      reason: "Reviewed change",
      articleId: created.id,
      authorId: toWorkforceEmployeeId(999),
      title: "Hacked",
      category: "hacked",
      tags: null,
      bodyMd: "Hacked body.",
    })

    expectApplicationError(forbidden, ForbiddenError, "knowledge_author_forbidden")
    expect(
      await fixture.db
        .prepare("SELECT title FROM knowledge_articles WHERE id = ?1")
        .bind(created.id)
        .first<string>("title"),
    ).toBe("Updated Title")
  })

  test("prepared knowledge authorization rejects account suspension before saving", async () => {
    const fixture = await authorFixture("suspended")
    const authorization = await fixture.ports.authorAuthorization.prepare(toWorkforceEmployeeId(1))
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
    const saved = await fixture.ports.articleRepository.createWithHistory(article, {
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
    const fixture = await authorFixture(
      "business-date",
      "1",
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    )
    const authorization = await fixture.ports.authorAuthorization.prepare(toWorkforceEmployeeId(1))
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
})
