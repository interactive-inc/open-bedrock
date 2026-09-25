import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftAssignments } from "@/contexts/shift/test/seed/seed-shift-assignments.test-support"
import { seedShiftPatterns } from "@/contexts/shift/test/seed/seed-shift-patterns.test-support"
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
  pool = await startLocalD1Pool(13)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "shift-assignment-crud-test-secret"

const shiftAssignmentResponseSchema = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  pattern_id: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
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
    "shift_patterns",
    seedShiftPatterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    })),
  )

  await seedD1(
    db,
    "shift_assignments",
    seedShiftAssignments.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employeeId,
      pattern_id: assignment.patternId,
      date: assignment.date,
      note: assignment.note,
      published_at: assignment.publishedAt,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /shift-assignments/:id", () => {
  test("privileged role reads an assignment and returns 200", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000001",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe("01900024-0000-7000-8000-000000000001")
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000001",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000001",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("PUT /shift-assignments/:id", () => {
  test("privileged role updates pattern, date and note and returns 200", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(1),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: "Updated" },
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.pattern_id).toBe("01900023-0000-7000-8000-000000000002")
      expect(parsed.data.date).toBe("2026-06-10")
      expect(parsed.data.note).toBe("Updated")
    }
  })

  test("clears the pattern when pattern_code is null", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(1),
      method: "PUT",
      body: { pattern_code: null, date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.pattern_id).toBe(null)
    }
  })

  test("returns 404 for an unknown pattern code", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(1),
      method: "PUT",
      body: { pattern_code: "UNKNOWN", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(5),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift-assignments/:id", () => {
  test("privileged role deletes an assignment and returns 204", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-00000000270f",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/shift-assignments/01900024-0000-7000-8000-000000000002",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
