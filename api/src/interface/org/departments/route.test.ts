import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const orgDepartmentResponseSchema = z.object({
  code: z.string(),
  department_id: z.number(),
  parent_code: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  order: z.number(),
})

const jwtSecret = "org-departments-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

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

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
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

describe("GET /org/departments", () => {
  test("returns 200 with snake_case department nodes", async () => {
    const response = await request({ path: "/org/departments", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(orgDepartmentResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(seedOrgDepartments.length)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/org/departments", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /org/departments", () => {
  test("creates a department node for a privileged role", async () => {
    const response = await request({
      path: "/org/departments",
      token: await adminToken(),
      method: "POST",
      body: {
        code: "D900",
        department_id: 1,
        parent_code: "D001",
        order: 9,
      },
    })

    expect(response.status).toBe(201)

    const parsed = orgDepartmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("D900")
      expect(parsed.data.parent_code).toBe("D001")
    }
  })

  test("rejects direct department responsibility changes", async () => {
    const response = await request({
      path: "/org/departments",
      token: await adminToken(),
      method: "POST",
      body: {
        code: "D900",
        department_id: 1,
        manager_employee_code: "E005",
        order: 9,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request({
      path: "/org/departments",
      token: await memberToken(),
      method: "POST",
      body: { code: "D901", department_id: 1, order: 1 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 for a duplicate code", async () => {
    const response = await request({
      path: "/org/departments",
      token: await adminToken(),
      method: "POST",
      body: { code: "D001", department_id: 1, order: 1 },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown parent code", async () => {
    const response = await request({
      path: "/org/departments",
      token: await adminToken(),
      method: "POST",
      body: { code: "D902", department_id: 1, parent_code: "D999", order: 1 },
    })

    expect(response.status).toBe(404)
  })
})
