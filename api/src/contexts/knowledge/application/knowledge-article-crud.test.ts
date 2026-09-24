import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { CreateKnowledgeArticle } from "@/contexts/knowledge/application/create-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"

const now = new Date("2026-01-01T00:00:00.000Z")

/**
 * 記事Repositoryと作成者認可Adapterを型付きfakeにして、application の業務判断だけを検証する。
 * 認可の再検査（失効・日付境界）と保存のtransactionは knowledge-article.repository.d1.test.ts が検証する。
 */
function createFakes(options: { forbidden?: boolean } = {}) {
  const articles = new Map<number, KnowledgeArticle>()
  const commands = new Map<string, { article: KnowledgeArticle; requestJson: string }>()
  const authorizations: EmployeeId[] = []

  const authorAuthorization = {
    prepare: async (authorId: EmployeeId) => {
      authorizations.push(authorId)
      if (options.forbidden === true)
        return new ForbiddenError(
          "current author employment is required",
          "knowledge_author_forbidden",
        )
      return { accountId: zAccountId.parse("1"), now, assertions: [] }
    },
  }

  const articleRepository = {
    createWithHistory: async (
      article: KnowledgeArticle,
      input: Readonly<{ commandId: string; requestJson: string }>,
    ) => {
      const saved = KnowledgeArticle.restore({ ...article.toJSON(), id: articles.size + 1 })
      articles.set(saved.id ?? 0, saved)
      commands.set(input.commandId, { article: saved, requestJson: input.requestJson })
      return saved
    },
    readRecordedCommand: async (input: Readonly<{ commandId: string }>) =>
      commands.get(input.commandId) ?? null,
    findById: async (id: number) => articles.get(id) ?? null,
    appendRevision: async (
      article: KnowledgeArticle,
      input: Readonly<{ expectedRevision: number; commandId: string; requestJson: string }>,
    ) => {
      if (article.id === null || articles.get(article.id)?.revision !== input.expectedRevision)
        return null
      articles.set(article.id, article)
      commands.set(input.commandId, { article, requestJson: input.requestJson })
      return article
    },
  }

  return { articleRepository, authorAuthorization, authorizations }
}

type Fakes = ReturnType<typeof createFakes>

async function seedArticle(fakes: Fakes, authorId: number): Promise<KnowledgeArticle> {
  const result = await new CreateKnowledgeArticle(fakes).run({
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

function updateCommand(articleId: number, authorId: number) {
  return {
    expectedRevision: 1,
    commandId: "update:test",
    reason: "Reviewed change",
    articleId,
    authorId: toWorkforceEmployeeId(authorId),
    title: "Updated Title",
    category: "design",
    tags: "updated",
    bodyMd: "Updated body.",
  }
}

describe("CreateKnowledgeArticle", () => {
  test("creates a new knowledge article", async () => {
    const fakes = createFakes()

    const result = await new CreateKnowledgeArticle(fakes).run({
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
    expect(result.createdAt).toBe(now.toISOString())
  })

  test("creates an article with tags", async () => {
    const fakes = createFakes()

    const result = await new CreateKnowledgeArticle(fakes).run({
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

  test("returns the author authorization failure without saving", async () => {
    const fakes = createFakes({ forbidden: true })

    const result = await new CreateKnowledgeArticle(fakes).run({
      title: "New Article",
      category: "general",
      tags: null,
      bodyMd: "Content here.",
      authorId: toWorkforceEmployeeId(999),
      commandId: "create:forbidden",
      reason: "Initial instructions",
    })

    expectApplicationError(result, ForbiddenError, "knowledge_author_forbidden")
    expect(await fakes.articleRepository.findById(1)).toBeNull()
  })
})

describe("UpdateKnowledgeArticle", () => {
  test("updates the article for the author", async () => {
    const fakes = createFakes()

    const article = await seedArticle(fakes, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(fakes).run(updateCommand(article.id, 1))

    expect(result).toBeInstanceOf(KnowledgeArticle)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.title).toBe("Updated Title")
    expect(result.category).toBe("design")
    expect(result.revision).toBe(2)
  })

  test("rejects an author whose authorization fails with knowledge_author_forbidden", async () => {
    const fakes = createFakes()

    const article = await seedArticle(fakes, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const forbidden = createFakes({ forbidden: true })

    const result = await new UpdateKnowledgeArticle({
      articleRepository: fakes.articleRepository,
      authorAuthorization: forbidden.authorAuthorization,
    }).run({ ...updateCommand(article.id, 999), title: "Hacked" })

    expectApplicationError(result, ForbiddenError, "knowledge_author_forbidden")
    expect((await fakes.articleRepository.findById(article.id))?.title).toBe("Test Article")
  })

  test("rejects an authorized employee who is not the author with not_author", async () => {
    const fakes = createFakes()

    const article = await seedArticle(fakes, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(fakes).run(updateCommand(article.id, 2))

    expectApplicationError(result, ForbiddenError, "not_author")
  })

  test("rejects unknown id with article_not_found", async () => {
    const fakes = createFakes()

    const result = await new UpdateKnowledgeArticle(fakes).run(updateCommand(9999, 1))

    expectApplicationError(result, NotFoundError, "article_not_found")
  })

  test("rejects a stale expected revision with knowledge_revision_conflict", async () => {
    const fakes = createFakes()

    const article = await seedArticle(fakes, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(fakes).run({
      ...updateCommand(article.id, 1),
      expectedRevision: 2,
    })

    expectApplicationError(result, ConflictError, "knowledge_revision_conflict")
  })

  test("replays a recorded command and rejects the same key for different content", async () => {
    const fakes = createFakes()

    const article = await seedArticle(fakes, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const first = await new UpdateKnowledgeArticle(fakes).run(updateCommand(article.id, 1))
    const replayed = await new UpdateKnowledgeArticle(fakes).run(updateCommand(article.id, 1))

    expect(replayed).toBe(first)

    const conflicting = await new UpdateKnowledgeArticle(fakes).run({
      ...updateCommand(article.id, 1),
      title: "Different",
    })

    expectApplicationError(conflicting, ConflictError, "knowledge_command_conflict")
  })
})
