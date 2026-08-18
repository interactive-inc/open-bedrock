import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedReviewCycles } from "@/contexts/performance-review/infrastructure/seed/seed-review-cycles"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"

const jwtSecret = "review-disclose-route-test-secret"

/** 2 件のフォームを hidden で投入する。開示後に disclosed へ変わることを検証する。 */
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

  await seedD1(db, "review_forms", [
    {
      id: 1,
      cycle_id: 1,
      subject_employee_id: 5,
      reviewer_employee_id: 5,
      reviewer_type: "self",
      answers: "[]",
      score: null,
      status: "pending",
      submitted_at: null,
      visibility: "hidden",
    },
    {
      id: 2,
      cycle_id: 1,
      subject_employee_id: 5,
      reviewer_employee_id: 4,
      reviewer_type: "manager",
      answers: "[]",
      score: 80,
      status: "submitted",
      submitted_at: "2026-06-01T00:00:00.000Z",
      visibility: "hidden",
    },
  ])

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null, method?: string): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method })
}

describe("POST /review-cycles/:cycleId/disclose", () => {
  test("admin discloses all forms in the cycle", async () => {
    const response = await request("/review-cycles/1/disclose", await adminToken(), "POST")

    expect(response.status).toBe(200)

    const parsed = z
      .object({ cycle_id: z.number(), disclosed_count: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.cycle_id).toBe(1)
      expect(parsed.data.disclosed_count).toBe(2)
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/review-cycles/1/disclose", await memberToken(), "POST")

    expect(response.status).toBe(403)
  })

  test("returns 404 when the cycle does not exist", async () => {
    const response = await request("/review-cycles/999/disclose", await adminToken(), "POST")

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/review-cycles/1/disclose", null, "POST")

    expect(response.status).toBe(401)
  })
})
