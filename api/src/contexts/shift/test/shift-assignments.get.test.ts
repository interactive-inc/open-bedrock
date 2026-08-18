import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedDepartments } from "@/contexts/company-compatibility/infrastructure/seed/seed-departments"
import { seedOrgDepartments } from "@/contexts/company-compatibility/infrastructure/seed/seed-org-departments"
import { seedShiftAssignments } from "@/contexts/shift/infrastructure/seed/seed-shift-assignments"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "shift-assignments-list-route-test-secret"

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
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
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

describe("GET /shift-assignments", () => {
  test("privileged role lists department shifts by dept_code", async () => {
    const response = await request({
      path: "/shift-assignments?dept_code=D003",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(shiftAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-assignments",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift-assignments", token: null })

    expect(response.status).toBe(401)
  })
})
