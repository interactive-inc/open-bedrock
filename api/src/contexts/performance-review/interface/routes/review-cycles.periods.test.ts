import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"
import { seedReviewCycles } from "@/contexts/performance-review/infrastructure/seed/seed-review-cycles.repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "review-cycles-periods-route-test-secret"

const periodListSchema = z.object({ data: z.array(z.string()) })

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
    "review_cycles",
    seedReviewCycles.map((cycle) => ({
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    })),
  )

  await initializeStandardCompanyTestState(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
  })
}

async function request(token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/review-cycles/periods",
    token,
  })
}

describe("GET /review-cycles/periods", () => {
  test("rejects an unauthenticated request", async () => {
    const response = await request(null)

    expect(response.status).toBe(401)
  })

  test("returns every period to a member regardless of the cycle status", async () => {
    const response = await request(await memberToken())

    expect(response.status).toBe(200)

    const parsed = periodListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // seed には open / closed / draft が 1 件ずつある。draft の期間も返す必要がある。
      expect(parsed.data.data).toContain("2026-H2")
      expect(parsed.data.data).toContain("2026-H1")
      expect(parsed.data.data).toContain("2025-H2")
    }
  })

  test("returns the same periods to a member as to an admin", async () => {
    const memberResponse = await request(await memberToken())

    const adminResponse = await request(await adminToken())

    const member = periodListSchema.parse(await memberResponse.json())

    const admin = periodListSchema.parse(await adminResponse.json())

    expect(member.data).toStrictEqual(admin.data)
  })

  test("sorts periods chronologically and does not repeat one", async () => {
    const response = await request(await adminToken())

    const parsed = periodListSchema.parse(await response.json())

    expect(parsed.data).toStrictEqual([...parsed.data].sort())
    expect(new Set(parsed.data).size).toBe(parsed.data.length)
  })

  test("does not leak the cycle title, status or due date", async () => {
    const response = await request(await memberToken())

    const body = await response.text()

    expect(body).not.toContain("多面評価")
    expect(body).not.toContain("draft")
    expect(body).not.toContain("due_date")
  })
})
