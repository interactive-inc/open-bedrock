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

const jwtSecret = "review-subject-forms-route-test-secret"

/** 被評価者 E005 のフォームを、1 件 disclosed / 1 件 hidden で投入する。 */
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
      score: 70,
      status: "submitted",
      submitted_at: "2026-06-01T00:00:00.000Z",
      visibility: "disclosed",
    },
    {
      id: 2,
      cycle_id: 1,
      subject_employee_id: "5",
      reviewer_employee_id: "4",
      reviewer_type: "manager",
      answers: "[]",
      score: 90,
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

/** E005 本人。 */
function subjectToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
  })
}

/** E006 別の一般社員。 */
function otherToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(6),
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /review-forms?subject_employee_id=", () => {
  test("admin sees all forms including hidden ones", async () => {
    const response = await request(
      "/performance-review/review-forms?subject_employee_id=5",
      await adminToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ form_count: z.number(), reviewer_type_summary: z.array(z.unknown()) })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.form_count).toBe(2)
      expect(parsed.data.reviewer_type_summary.length).toBe(2)
    }
  })

  test("subject only sees disclosed forms", async () => {
    const response = await request(
      "/performance-review/review-forms?subject_employee_id=5",
      await subjectToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({
        form_count: z.number(),
        forms: z.array(z.object({ visibility: z.string(), reviewer_type: z.string() })),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.form_count).toBe(1)
      expect(parsed.data.forms[0].visibility).toBe("disclosed")
      expect(parsed.data.forms[0].reviewer_type).toBe("self")
    }
  })

  test("another employee is forbidden", async () => {
    const response = await request(
      "/performance-review/review-forms?subject_employee_id=5",
      await otherToken(),
    )

    expect(response.status).toBe(403)
  })

  test("returns 400 without subject_employee_id", async () => {
    const response = await request("/performance-review/review-forms", await adminToken())

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/performance-review/review-forms?subject_employee_id=5", null)

    expect(response.status).toBe(401)
  })
})
