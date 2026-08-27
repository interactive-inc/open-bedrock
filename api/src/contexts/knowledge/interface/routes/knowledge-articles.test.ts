import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedKnowledgeArticles } from "@/contexts/knowledge/test/seed/seed-knowledge-articles.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const knowledgeSearchResultResponseSchema = z.object({
  id: z.number(),
  category: z.string(),
  title: z.string(),
  snippet: z.string(),
  author_id: zEmployeeId,
})

const knowledgeCreatedResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})

const jwtSecret = "knowledge-list-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
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
  await initializeStandardCompanyTestState(db)

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(1),
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

const knowledgeListResponseSchema = z.object({
  data: z.array(knowledgeSearchResultResponseSchema),
  total: z.number(),
})

describe("GET /knowledge-articles", () => {
  test("returns 200 with all articles in CLI search shape", async () => {
    const response = await request("/knowledge-articles", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(6)
      expect(parsed.data.total).toBe(6)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.title).toBe("リモートワーク規程")
      expect(first?.category).toBe("規程")
      expect(first?.snippet.length).toBeGreaterThan(0)
    }
  })

  test("filters by category query", async () => {
    const response = await request("/knowledge-articles?category=経理", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(2)
    }
  })

  test("filters by keyword query", async () => {
    const response = await request("/knowledge-articles?q=リモートワーク", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(1)
    }
  })

  test("treats % as a literal so it cannot match every article", async () => {
    const response = await request("/knowledge-articles?q=%25", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
      expect(parsed.data.total).toBe(0)
    }
  })

  test("applies limit and returns at most that many articles", async () => {
    const response = await request("/knowledge-articles?limit=2", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(6)
    }
  })

  test("clamps limit above MAX to MAX_LIST_LIMIT and still returns 200", async () => {
    const response = await request("/knowledge-articles?limit=9999", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)
  })

  test("falls back to DEFAULT_LIST_LIMIT on a mixed string limit and returns 200", async () => {
    const response = await request("/knowledge-articles?limit=50abc", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // default limit (50) >= 6 seed articles, so all are returned
      expect(parsed.data.data.length).toBe(6)
    }
  })

  test("applies a huge offset exceeding 32-bit int and returns 200 with empty result", async () => {
    const response = await request("/knowledge-articles?offset=9999999999999", await memberToken())

    expect(response.status).toBe(200)

    const parsed = knowledgeListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // offset clamped to MAX_LIST_OFFSET (2_147_483_647) — far beyond any row
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/knowledge-articles", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /knowledge-articles", () => {
  test("persists created_at from the injected NOW", async () => {
    const db = await createTestDb()

    const now = "2026-03-15T12:00:00.000Z"

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/knowledge-articles",
      token: await memberToken(),
      method: "POST",
      body: { title: "New Article", category: "Policy", body_md: "hello body" },
      now,
    })

    expect(response.status).toBe(201)

    const parsed = knowledgeCreatedResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const createdAt = await db
        .prepare("SELECT created_at FROM knowledge_articles WHERE id = ?")
        .bind(parsed.data.id)
        .first("created_at")

      expect(createdAt).toBe(now)
    }
  })
})
