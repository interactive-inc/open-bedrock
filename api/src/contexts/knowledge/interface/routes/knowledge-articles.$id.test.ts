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

const knowledgeArticleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
  author_id: zEmployeeId,
})

const jwtSecret = "knowledge-detail-route-test-secret"

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

describe("GET /knowledge-articles/:id", () => {
  test("returns 200 with the article in CLI detail shape", async () => {
    const response = await request("/knowledge/knowledge-articles/4", await memberToken())

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
    const response = await request("/knowledge/knowledge-articles/4", null)

    expect(response.status).toBe(401)
  })

  test("returns 404 when the id is not a positive integer", async () => {
    const response = await request("/knowledge/knowledge-articles/abc", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 404 when the article does not exist", async () => {
    const response = await request("/knowledge/knowledge-articles/9999", await memberToken())

    expect(response.status).toBe(404)
  })
})
