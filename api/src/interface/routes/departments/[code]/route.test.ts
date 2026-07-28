import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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
    role: "root",
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
  setup?: (db: D1Database) => Promise<void>
}

async function request(props: RequestProps): Promise<Response> {
  const db = await createTestDb()
  await props.setup?.(db)
  return requestWithContext({
    db,
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /departments/:code", () => {
  test("returns 200 with the department node", async () => {
    const response = await request({ path: "/departments/D002", token: await memberToken() })

    expect(response.status).toBe(200)

    const parsed = orgDepartmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("D002")
      expect(parsed.data.parent_code).toBe("D001")
    }
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({ path: "/departments/D999", token: await memberToken() })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/departments/D002", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /departments/:code", () => {
  test("updates hierarchy metadata without bypassing lifecycle responsibility", async () => {
    const response = await request({
      path: "/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D001", order: 7 },
    })

    expect(response.status).toBe(200)

    const parsed = orgDepartmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.manager_employee_code).toBe("E004")
      expect(parsed.data.order).toBe(7)
    }
  })

  test("rejects direct department responsibility changes", async () => {
    const response = await request({
      path: "/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { manager_employee_code: "E005", order: 7 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request({
      path: "/departments/D003",
      token: await memberToken(),
      method: "PUT",
      body: { order: 1 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/departments/D999",
      token: await adminToken(),
      method: "PUT",
      body: { order: 1 },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when a department is set as its own parent", async () => {
    const response = await request({
      path: "/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D003", order: 1 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 409 for an indirect circular reference (A→B→A)", async () => {
    // Seed: D002.parent = D001. Setting D001.parent = D002 creates D001→D002→D001.
    const response = await request({
      path: "/departments/D001",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D002", order: 1 },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 for a 3-level circular reference (A→B→C→A)", async () => {
    // Seed: D005.parent = D004, D004.parent = D001. Setting D001.parent = D005 creates D001→D005→D004→D001.
    const response = await request({
      path: "/departments/D001",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D005", order: 1 },
    })

    expect(response.status).toBe(409)
  })

  test("allows a valid parent change that does not create a cycle", async () => {
    // Moving D003 under D002 is fine — no cycle.
    const response = await request({
      path: "/departments/D003",
      token: await adminToken(),
      method: "PUT",
      body: { parent_code: "D002", order: 1 },
    })

    expect(response.status).toBe(200)
  })
})

describe("DELETE /departments/:code", () => {
  test("returns 403 for a non-privileged role", async () => {
    const response = await request({
      path: "/departments/D002",
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/departments/D999",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when the department has children or members", async () => {
    const response = await request({
      path: "/departments/D001",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 204 when an empty leaf department is archived", async () => {
    const response = await request({
      path: "/departments/D006",
      token: await adminToken(),
      method: "DELETE",
      setup: async (db) => {
        await db.exec(`
          INSERT INTO employment_period_versions
            (period_id, revision, employee_id, starts_on, ends_on, is_void,
             recorded_by_action_id, recorded_at)
          VALUES ('fixture-employment-e001', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1);
          INSERT INTO employee_status_period_versions
            (period_id, revision, employment_period_id, employee_id, status, starts_on,
             ends_on, is_void, recorded_by_action_id, recorded_at)
          VALUES ('fixture-status-e001', 1, 'fixture-employment-e001', 1, 'active',
                  '2025-01-01', NULL, 0, 'fixture', 1);
          UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
        `)
      },
    })

    expect(response.status).toBe(204)
  })
})
