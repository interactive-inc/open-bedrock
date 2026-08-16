import { describe, expect, test } from "bun:test"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/knowledge-article.entity"
import { CreateKnowledgeArticle } from "@/contexts/knowledge/application/create-knowledge-article"
import { UpdateKnowledgeArticle } from "@/contexts/knowledge/application/update-knowledge-article"
import { DeleteKnowledgeArticle } from "@/contexts/knowledge/application/delete-knowledge-article"
import { createTestContext } from "@/api/test/support/create-test-context"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { ApplicationError, ForbiddenError, NotFoundError } from "@/lib/errors"
import type { Context } from "@/env"

async function seedArticle(context: Context, authorId: number): Promise<KnowledgeArticle> {
  const result = await new CreateKnowledgeArticle(context).run({
    title: "Test Article",
    category: "engineering",
    tags: "test,article",
    bodyMd: "# Test\n\nBody text.",
    authorId: authorId,
    createdAt: "2026-03-15T09:00:00.000Z",
  })

  if (result instanceof Error) {
    throw new Error("seed failed")
  }

  return result
}

describe("CreateKnowledgeArticle", () => {
  test("creates a new knowledge article", async () => {
    const { context } = createTestContext()

    const result = await new CreateKnowledgeArticle(context).run({
      title: "New Article",
      category: "general",
      tags: null,
      bodyMd: "Content here.",
      authorId: 1,
      createdAt: "2026-03-15T09:00:00.000Z",
    })

    expect(result).toBeInstanceOf(KnowledgeArticle)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.title).toBe("New Article")
    expect(result.category).toBe("general")
    expect(result.tags).toBeNull()
    expect(result.authorId).toBe(1)
  })

  test("creates an article with tags", async () => {
    const { context } = createTestContext()

    const result = await new CreateKnowledgeArticle(context).run({
      title: "Tagged Article",
      category: "engineering",
      tags: "typescript,testing",
      bodyMd: "Content.",
      authorId: 2,
      createdAt: "2026-03-15T10:00:00.000Z",
    })

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.tags).toBe("typescript,testing")
  })
})

describe("UpdateKnowledgeArticle", () => {
  test("updates the article for the author", async () => {
    const { context } = createTestContext()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(context).run({
      articleId: article.id,
      authorId: 1,
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
    const { context } = createTestContext()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new UpdateKnowledgeArticle(context).run({
      articleId: article.id,
      authorId: 999,
      title: "Hacked",
      category: "hacked",
      tags: null,
      bodyMd: "Hacked body.",
    })

    expectApplicationError(result, ForbiddenError, "not_author")
  })

  test("rejects unknown id with article_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateKnowledgeArticle(context).run({
      articleId: 9999,
      authorId: 1,
      title: "Ghost",
      category: "ghost",
      tags: null,
      bodyMd: "Ghost body.",
    })

    expectApplicationError(result, NotFoundError, "article_not_found")
  })
})

describe("DeleteKnowledgeArticle", () => {
  test("deletes the article for the author", async () => {
    const { context } = createTestContext()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new DeleteKnowledgeArticle(context).run({
      articleId: article.id,
      authorId: 1,
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects delete by non-author with not_author", async () => {
    const { context } = createTestContext()

    const article = await seedArticle(context, 1)

    if (article.id === null) {
      throw new Error("seed returned null id")
    }

    const result = await new DeleteKnowledgeArticle(context).run({
      articleId: article.id,
      authorId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_author")
  })

  test("rejects unknown id with article_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteKnowledgeArticle(context).run({
      articleId: 9999,
      authorId: 1,
    })

    expectApplicationError(result, NotFoundError, "article_not_found")
  })
})
