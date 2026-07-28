import { describe, expect, test } from "bun:test"
import { seedApplicationTemplates } from "@/infrastructure/seed/seed-application-templates"
import { seedApplications } from "@/infrastructure/seed/seed-applications"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "application-mine-route-test-secret"

const applicationResponseSchema = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  template_category: z.string(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "application_templates",
    seedApplicationTemplates.map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      description: template.description,
      schema_json: JSON.stringify(template.schemaJson),
      approver_roles: JSON.stringify(template.approverRoles),
    })),
  )

  await seedD1(
    db,
    "application_requests",
    seedApplications.map((application) => ({
      id: application.id,
      template_id: application.templateId,
      applicant_id: application.applicantId,
      status: application.status,
      current_step: application.currentStep,
      payload: JSON.stringify(application.payload),
      created_at: application.createdAt,
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

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

async function request(
  path: string,
  token: string | null,
  init?: { method: string; body: unknown },
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method: init?.method,
    body: init?.body,
  })
}

describe("GET /application-requests", () => {
  test("returns 200 with the mine columns for the token employee", async () => {
    const response = await request("/application-requests", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.template_name).toBe("Paid Leave Request")
    }
  })

  test("filters by status", async () => {
    const response = await request(
      "/application-requests?status=approved",
      await tokenFor(10, "member"),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("approved")
    }
  })

  test("returns only 1 application when limit=1", async () => {
    const response = await request("/application-requests?limit=1", await tokenFor(5, "member"))

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/application-requests", null)

    expect(response.status).toBe(401)
  })
})

const scopeEmployeeRows = [
  { id: 2, code: "M002", name: "Mgr", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", name: "ReportA", email: "you+r020@example.com", role: "member" },
  { id: 21, code: "R021", name: "ReportB", email: "you+r021@example.com", role: "member" },
  { id: 22, code: "S022", name: "Solo", email: "you+s022@example.com", role: "manager" },
]

async function createDepartmentScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: 1,
      dept_name: "Dept",
      position: "-",
      status: "active",
    })),
  )

  await seedIamForEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  // root(id 23, 所属なし)を追加する。
  await seedD1(db, "employees", [
    {
      id: 23,
      code: "A023",
      name: "Admin",
      dept_id: 1,
      dept_name: "Dept",
      position: "-",
      status: "active",
    },
  ])

  await seedIamForEmployees(db, [
    { id: 23, email: "you+a023@example.com", passwordHash: "x", role: "root" },
  ])

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D001", employee_code: "R021", manager_employee_code: "M002" },
    { department_code: "D002", employee_code: "S022", manager_employee_code: null },
  ])

  await seedD1(
    db,
    "application_templates",
    seedApplicationTemplates.map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      description: template.description,
      schema_json: JSON.stringify(template.schemaJson),
      approver_roles: JSON.stringify(template.approverRoles),
    })),
  )

  await seedD1(db, "application_requests", [
    {
      id: 100,
      template_id: 1,
      applicant_id: 20,
      status: "pending",
      current_step: "manager_approval",
      payload: JSON.stringify({}),
      created_at: "2026-06-01T00:00:00Z",
    },
    {
      id: 101,
      template_id: 1,
      applicant_id: 21,
      status: "approved",
      current_step: null,
      payload: JSON.stringify({}),
      created_at: "2026-06-02T00:00:00Z",
    },
    {
      id: 102,
      template_id: 1,
      applicant_id: 22,
      status: "pending",
      current_step: "manager_approval",
      payload: JSON.stringify({}),
      created_at: "2026-06-03T00:00:00Z",
    },
  ])

  return db
}

async function grantDepartmentReader(
  db: D1Database,
  accountId: number,
  permissionKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO roles (id, key, name, description, is_system, created_at)
       VALUES (900, 'dept_reader', 'dept reader', '', 0, 0)`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT 900, p.id FROM permissions p WHERE p.key = ?1`,
    )
    .bind(permissionKey)
    .run()

  await db
    .prepare(
      `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
       VALUES (?1, 900, NULL, 0)`,
    )
    .bind(accountId)
    .run()
}

describe("GET /application-requests?scope=department", () => {
  test("admin lists only the requested department's applications", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/application-requests?scope=department&department_code=D001",
      token: await tokenFor(23, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const applicantIds = parsed.data.data
        .map((application) => application.applicant_id)
        .sort((a, b) => a - b)

      expect(applicantIds).toEqual([20, 21])
    }
  })

  test("department reader in the department lists its applications", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20, "application:read:department")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/application-requests?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(applicationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
    }
  })

  test("department reader outside the department is forbidden", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20, "application:read:department")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/application-requests?scope=department&department_code=D002",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("member without department permission is forbidden", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/application-requests?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("missing department_code is unprocessable", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/application-requests?scope=department",
      token: await tokenFor(23, "root"),
    })

    expect(response.status).toBe(422)
  })
})
