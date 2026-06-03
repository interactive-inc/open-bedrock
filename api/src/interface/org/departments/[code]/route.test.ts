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
import { z } from "zod"

const orgDepartmentResponseSchema = z.object({
  code: z.string(),
  department_id: z.number(),
  parent_code: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  order: z.number(),
})

const jwtSecret = "org-department-detail-route-test-secret"

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
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

describe("GET /org/departments/:code", () => {
  test("returns 200 with the department node", async () => {
    const response = await request({ path: "/org/departments/D002", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = orgDepartmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("D002")
      expect(parsed.data.parent_code).toBe("D001")
    }
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({ path: "/org/departments/D999", token: await memberToken() })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/org/departments/D002", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /org/departments/:code", () => {
  test("updates manager and order for a privileged role", async () => {
    const response = await request({
      path: "/org/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D001", manager_employee_code: "E005", order: 7 },
    })

    expect(response.status).toBe(200)

    const parsed = orgDepartmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.manager_employee_code).toBe("E005")
      expect(parsed.data.order).toBe(7)
    }
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request({
      path: "/org/departments/D003",
      token: await memberToken(),
      method: "PUT",
      body: { order: 1 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/org/departments/D999",
      token: await adminToken(),
      method: "PUT",
      body: { order: 1 },
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when a department is set as its own parent", async () => {
    const response = await request({
      path: "/org/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D003", order: 1 },
    })

    expect(response.status).toBe(409)
  })
})

describe("DELETE /org/departments/:code", () => {
  test("returns 403 for a non-privileged role", async () => {
    const response = await request({
      path: "/org/departments/D002",
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/org/departments/D999",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the department has children or members", async () => {
    const response = await request({
      path: "/org/departments/D001",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 204 when an empty leaf department is deleted", async () => {
    const response = await request({
      path: "/org/departments/D006",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })
})
