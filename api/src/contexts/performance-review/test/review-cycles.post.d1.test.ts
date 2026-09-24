import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedReviewCycles } from "@/contexts/performance-review/test/seed/seed-review-cycles.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
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

const jwtSecret = "review-cycles-create-route-test-secret"

const reviewCycleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  period: z.string(),
  status: z.enum(["draft", "open", "closed"]),
  due_date: z.string().nullable(),
})

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

describe("POST /review-cycles", () => {
  test("admin creates a cycle in draft status and returns 201", async () => {
    const response = await request(
      "/performance-review/review-cycles",
      await adminToken(),
      "POST",
      {
        title: "2026 H2",
        period: "2026-H2",
      },
    )

    expect(response.status).toBe(201)

    const parsed = reviewCycleResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("draft")
      expect(parsed.data.due_date).toBeNull()
    }
  })

  test("member is forbidden", async () => {
    const response = await request(
      "/performance-review/review-cycles",
      await memberToken(),
      "POST",
      {
        title: "x",
        period: "2026-H2",
      },
    )

    expect(response.status).toBe(403)
  })

  test("returns 400 when title is missing", async () => {
    const response = await request(
      "/performance-review/review-cycles",
      await adminToken(),
      "POST",
      {
        period: "2026-H2",
      },
    )

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/performance-review/review-cycles", null, "POST", {
      title: "x",
      period: "2026-H2",
    })

    expect(response.status).toBe(401)
  })
})
