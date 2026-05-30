import { describe, expect, test } from "bun:test"
import { seedKnowledgeArticles } from "@/infrastructure/seed/seed-knowledge-articles"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const knowledgeArticleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})

const jwtSecret = "knowledge-detail-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "knowledge_articles",
    seedKnowledgeArticles.map((article) => ({
      id: article.id,
      title: article.title,
      category: article.category,
      tags: article.tags,
      body_md: article.bodyMd,
      author_id: article.authorId,
      created_at: article.createdAt,
    })),
  )

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /knowledge/:id", () => {
  test("returns 200 with the article in CLI detail shape", async () => {
    const response = await request("/knowledge/4", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeArticleResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(4)
      expect(parsed.data.title).toBe("Goal Setting and Evaluation")
      expect(parsed.data.category).toBe("Evaluation")
      expect(parsed.data.tags).toBe("goal,evaluation,MBO")
      expect(parsed.data.body_md.length).toBeGreaterThan(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/knowledge/4", null)

    expect(response.status).toBe(401)
  })

  test("returns 400 when the id is not a positive integer", async () => {
    const response = await request("/knowledge/abc", await memberToken())

    expect(response.status).toBe(400)
  })

  test("returns 404 when the article does not exist", async () => {
    const response = await request("/knowledge/9999", await memberToken())

    expect(response.status).toBe(404)
  })
})
