import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { KnowledgeArticle } from "@/contexts/knowledge/domain/entities/knowledge-article.entity"
import { describe, expect, test } from "bun:test"

describe("KnowledgeArticle.create", () => {
  test("builds with null id", () => {
    const article = KnowledgeArticle.create({
      title: "How to deploy",
      category: "engineering",
      tags: "deploy,ci",
      bodyMd: "# Steps\n\n1. Build\n2. Deploy",
      authorId: toWorkforceEmployeeId(5),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(article).toBeInstanceOf(KnowledgeArticle)
    expect(article.id).toBe(null)
    expect(article.title).toBe("How to deploy")
    expect(article.category).toBe("engineering")
  })
})

describe("KnowledgeArticle.withContent", () => {
  test("returns new article with changed content", () => {
    const article = KnowledgeArticle.create({
      title: "Original",
      category: "general",
      tags: null,
      bodyMd: "body",
      authorId: toWorkforceEmployeeId(5),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const updated = article.withContent({
      title: "Updated",
      category: "engineering",
      tags: "new-tag",
      bodyMd: "new body",
    })

    expect(updated.title).toBe("Updated")
    expect(updated.category).toBe("engineering")
    expect(updated.tags).toBe("new-tag")
    expect(updated.bodyMd).toBe("new body")
    expect(updated.authorId).toBe(toWorkforceEmployeeId(5))
  })
})
