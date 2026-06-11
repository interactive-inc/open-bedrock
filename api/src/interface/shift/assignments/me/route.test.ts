import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedShiftAssignments } from "@/infrastructure/seed/seed-shift-assignments"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "shift-assignments-me-route-test-secret"

const shiftAssignmentResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  pattern_id: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedD1(
    db,
    "org_departments",
    seedOrgDepartments.map((department) => ({
      code: department.code,
      department_id: department.departmentId,
      parent_code: department.parentCode,
      manager_employee_code: department.managerEmployeeCode,
      sort_order: department.order,
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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
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

describe("GET /shift/assignments/me", () => {
  test("returns the caller's own assignments", async () => {
    const response = await request({
      path: "/shift/assignments/me",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(shiftAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // id=2 は publishedAt が null（下書き）なので除外され、公開済みの 1 件のみ返る
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data.every((row) => row.employee_id === 5)).toBe(true)
      expect(parsed.data.data.every((row) => row.published_at !== null)).toBe(true)
    }
  })

  test("filters own assignments by date range", async () => {
    const response = await request({
      path: "/shift/assignments/me?from=2026-06-01&to=2026-06-01",
      token: await tokenFor(5, "member"),
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
      path: "/shift/assignments/me?from=2026-06-02&to=2026-06-02",
      token: await tokenFor(5, "member"),
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
    const response = await request({ path: "/shift/assignments/me", token: null })

    expect(response.status).toBe(401)
  })
})
