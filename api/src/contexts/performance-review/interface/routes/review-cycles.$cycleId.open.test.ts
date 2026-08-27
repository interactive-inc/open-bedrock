import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
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
import { z } from "zod"

const jwtSecret = "review-cycles-open-route-test-secret"

const reviewCycleResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  period: z.string(),
  status: z.enum(["draft", "open", "closed"]),
  due_date: z.string().nullable(),
})

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

describe("POST /review-cycles/:cycleId/open and /close", () => {
  test("admin opens the draft cycle and returns 200", async () => {
    const response = await request(
      "/performance-review/review-cycles/3/open",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(200)

    const parsed = reviewCycleResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("open")
    }
  })

  test("close returns 404 for a missing cycle", async () => {
    const response = await request(
      "/performance-review/review-cycles/9999/close",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(404)
  })

  test("member opening a cycle is forbidden", async () => {
    const response = await request(
      "/performance-review/review-cycles/1/open",
      await memberToken(),
      "POST",
    )

    expect(response.status).toBe(403)
  })

  test("closed cycle cannot be opened (409)", async () => {
    const response = await request(
      "/performance-review/review-cycles/2/open",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(409)
  })

  test("already open cycle cannot be opened again (409)", async () => {
    const response = await request(
      "/performance-review/review-cycles/1/open",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(409)
  })

  test("draft cycle cannot be closed directly (409)", async () => {
    const response = await request(
      "/performance-review/review-cycles/3/close",
      await adminToken(),
      "POST",
    )

    expect(response.status).toBe(409)
  })
})
