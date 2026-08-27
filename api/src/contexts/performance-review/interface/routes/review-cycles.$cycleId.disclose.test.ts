import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedReviewCycles } from "@/contexts/performance-review/test/seed/seed-review-cycles.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "review-disclose-route-test-secret"

/** 2 件のフォームを hidden で投入する。開示後に disclosed へ変わることを検証する。 */
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
      subject_employee_id: "5",
      reviewer_employee_id: "5",
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
      subject_employee_id: "5",
      reviewer_employee_id: "4",
      reviewer_type: "manager",
      answers: "[]",
      score: 80,
      status: "submitted",
      submitted_at: "2026-06-01T00:00:00.000Z",
      visibility: "hidden",
    },
  ])
  await initializeStandardCompanyTestState(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(1),
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
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
