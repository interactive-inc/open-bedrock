import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftAssignments } from "@/contexts/shift/test/seed/seed-shift-assignments.test-support"
import { seedShiftPatterns } from "@/contexts/shift/test/seed/seed-shift-patterns.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "shift-assignments-me-route-test-secret"

const shiftAssignmentResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  pattern_id: z.number().nullable(),
  pattern_name: z.string().nullable(),
  pattern_start_time: z.string().nullable(),
  pattern_end_time: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
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

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /shift-assignments/me", () => {
  test("returns the caller's own assignments", async () => {
    const response = await request({
      path: "/shift-assignments/me",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(shiftAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // id=2 は publishedAt が null（下書き）なので除外され、公開済みの 1 件のみ返る
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data.every((row) => row.employee_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
      expect(parsed.data.data.every((row) => row.published_at !== null)).toBe(true)
      // member はパターン一覧を閲覧できないため、割当にパターン名・時間帯を埋めて返す（patternId=1 = Early）
      expect(parsed.data.data[0]?.pattern_name).toBe("早番")
      expect(parsed.data.data[0]?.pattern_start_time).toBe("07:00")
      expect(parsed.data.data[0]?.pattern_end_time).toBe("16:00")
    }
  })

  test("filters own assignments by date range", async () => {
    const response = await request({
      path: "/shift-assignments/me?from=2026-06-01&to=2026-06-01",
      token: await tokenFor(5),
    })

    const parsed = z
      .object({ data: z.array(shiftAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // id=1 は公開済み (2026-06-01)。id=2 は下書き (2026-06-02) なので対象外。
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(1)
    }
  })

  test("excludes draft assignments (publishedAt is null)", async () => {
    // 2026-06-02 にはシード id=2 があるが publishedAt=null なので返らない
    const response = await request({
      path: "/shift-assignments/me?from=2026-06-02&to=2026-06-02",
      token: await tokenFor(5),
    })

    const parsed = z
      .object({ data: z.array(shiftAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift-assignments/me", token: null })

    expect(response.status).toBe(401)
  })
})
