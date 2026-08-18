import { describe, expect, test } from "bun:test"
import { seedKnowledgeArticles } from "@/contexts/knowledge/infrastructure/seed/seed-knowledge-articles"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const knowledgeArticleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
  author_id: z.number(),
})

const jwtSecret = "knowledge-detail-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

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
    role: "root",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /knowledge-articles/:id", () => {
  test("returns 200 with the article in CLI detail shape", async () => {
    const response = await request("/knowledge-articles/4", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeArticleResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(4)
      expect(parsed.data.title).toBe("目標設定と評価")
      expect(parsed.data.category).toBe("評価")
      expect(parsed.data.tags).toBe("目標,評価,MBO")
      expect(parsed.data.body_md.length).toBeGreaterThan(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/knowledge-articles/4", null)

    expect(response.status).toBe(401)
  })

  test("returns 404 when the id is not a positive integer", async () => {
    const response = await request("/knowledge-articles/abc", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 404 when the article does not exist", async () => {
    const response = await request("/knowledge-articles/9999", await memberToken())

    expect(response.status).toBe(404)
  })
})
