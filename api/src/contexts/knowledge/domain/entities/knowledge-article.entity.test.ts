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

test("改訂と取下げは以前の本文・著者・作成日を保全し、版を進める", () => {
  const original = KnowledgeArticle.create({
    title: "Procedure",
    category: "Operations",
    tags: null,
    bodyMd: "Original text",
    authorId: toWorkforceEmployeeId(5),
    createdAt: "2026-01-01T00:00:00Z",
  })
  const updated = original.withContent({
    title: "Updated procedure",
    category: "Operations",
    tags: null,
    bodyMd: "Reviewed text",
  })
  expect(original.revision).toBe(1)
  expect(original.bodyMd).toBe("Original text")
  expect(updated.revision).toBe(2)
  expect(updated.authorId).toBe(original.authorId)
  expect(updated.createdAt).toBe(original.createdAt)
  const withdrawn = updated.withdraw()
  expect(withdrawn.revision).toBe(3)
  expect(withdrawn.status).toBe("withdrawn")
  expect(withdrawn.bodyMd).toBe("Reviewed text")
  expect(updated.status).toBe("active")
  expect(() =>
    withdrawn.withContent({
      title: "Hidden change",
      category: "Operations",
      tags: null,
      bodyMd: "Replacement",
    }),
  ).toThrow()
  expect(() => withdrawn.withdraw()).toThrow()
})
