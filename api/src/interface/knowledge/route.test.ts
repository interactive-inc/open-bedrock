import { describe, expect, test } from "bun:test"
import { seedKnowledgeArticles } from "@/infrastructure/seed/seed-knowledge-articles"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const knowledgeSearchResultResponseSchema = z.object({
  id: z.number(),
  category: z.string(),
  title: z.string(),
  snippet: z.string(),
})

const jwtSecret = "knowledge-list-route-test-secret"

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

describe("GET /knowledge", () => {
  test("returns 200 with all articles in CLI search shape", async () => {
    const response = await request("/knowledge", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(knowledgeSearchResultResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(6)

      const first = parsed.data.find((item) => item.id === 1)

      expect(first?.title).toBe("Remote Work Policy")
      expect(first?.category).toBe("Policy")
      expect(first?.snippet.length).toBeGreaterThan(0)
    }
  })

  test("filters by category query", async () => {
    const response = await request("/knowledge?category=Accounting", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(knowledgeSearchResultResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.id).toBe(2)
    }
  })

  test("filters by keyword query", async () => {
    const response = await request("/knowledge?q=remote", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(knowledgeSearchResultResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.id).toBe(1)
    }
  })

  test("treats % as a literal so it cannot match every article", async () => {
    const response = await request("/knowledge?q=%25", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(knowledgeSearchResultResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/knowledge", null)

    expect(response.status).toBe(401)
  })
})
