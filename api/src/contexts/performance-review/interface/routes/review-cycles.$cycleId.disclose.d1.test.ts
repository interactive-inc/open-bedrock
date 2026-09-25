import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedReviewCycles } from "@/contexts/performance-review/test/seed/seed-review-cycles.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(4)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "review-disclose-route-test-secret"

/** 2 件のフォームを hidden で投入する。開示後に disclosed へ変わることを検証する。 */
async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

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
      id: "01900033-0000-7000-8000-000000000001",
      cycle_id: "01900032-0000-7000-8000-000000000001",
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
      id: "01900033-0000-7000-8000-000000000002",
      cycle_id: "01900032-0000-7000-8000-000000000001",
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
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/disclose",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ cycle_id: z.uuid(), disclosed_count: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.cycle_id).toBe("01900032-0000-7000-8000-000000000001")
      expect(parsed.data.disclosed_count).toBe(2)
    }
  })

  test("member is forbidden", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/disclose",
      await memberToken(),
      "POST",
    )

    expect(response.status).toBe(403)
  })

  test("returns 404 when the cycle does not exist", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-0000000003e7/disclose",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/disclose",
      null,
      "POST",
    )

    expect(response.status).toBe(401)
  })
})
