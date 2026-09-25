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
  pool = await startLocalD1Pool(5)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "review-forms-bulk-route-test-secret"

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

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("POST /review-cycles/:cycleId/forms/bulk", () => {
  test("admin creates self/manager/peer forms in one call and they start hidden", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/forms/bulk",
      await adminToken(),
      "POST",
      {
        forms: [
          { subject_employee_id: "5", reviewer_employee_id: "5", reviewer_type: "self" },
          { subject_employee_id: "5", reviewer_employee_id: "4", reviewer_type: "manager" },
          { subject_employee_id: "5", reviewer_employee_id: "2", reviewer_type: "peer" },
        ],
      },
    )

    expect(response.status).toBe(201)

    const parsed = z
      .object({
        created_count: z.number(),
        forms: z.array(
          z.object({ visibility: z.string(), status: z.string(), cycle_id: z.uuid() }),
        ),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.created_count).toBe(3)
      expect(parsed.data.forms.length).toBe(3)

      for (const form of parsed.data.forms) {
        expect(form.visibility).toBe("hidden")
        expect(form.status).toBe("pending")
        expect(form.cycle_id).toBe("01900032-0000-7000-8000-000000000001")
      }
    }
  })

  test("member is forbidden", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/forms/bulk",
      await memberToken(),
      "POST",
      {
        forms: [{ subject_employee_id: "5", reviewer_employee_id: "5", reviewer_type: "self" }],
      },
    )

    expect(response.status).toBe(403)
  })

  test("returns 404 when the cycle does not exist", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-0000000003e7/forms/bulk",
      await adminToken(),
      "POST",
      {
        forms: [{ subject_employee_id: "5", reviewer_employee_id: "5", reviewer_type: "self" }],
      },
    )

    expect(response.status).toBe(404)
  })

  test("returns 404 when a referenced employee does not exist", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/forms/bulk",
      await adminToken(),
      "POST",
      {
        forms: [{ subject_employee_id: "5", reviewer_employee_id: "9999", reviewer_type: "peer" }],
      },
    )

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request(
      "/performance-review/review-cycles/01900032-0000-7000-8000-000000000001/forms/bulk",
      null,
      "POST",
      {
        forms: [],
      },
    )

    expect(response.status).toBe(401)
  })
})
