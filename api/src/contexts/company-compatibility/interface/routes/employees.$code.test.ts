import { describe, expect, test } from "bun:test"
import type { Bindings } from "@/env"
import * as employeeDetailRoute from "@/contexts/company-compatibility/interface/routes/employees.$code"
import * as employeeListRoute from "@/contexts/company-compatibility/interface/routes/employees"
import { databaseMiddleware } from "@/api/database-middleware"
import { requestContextMiddleware } from "@/contexts/company-compatibility/interface/middlewares/request-context-middleware"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedDepartments } from "@/contexts/company-compatibility/infrastructure/seed/seed-departments"
import { seedOrgDepartments } from "@/contexts/company-compatibility/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/contexts/company-compatibility/infrastructure/seed/seed-org-memberships"
import { seedPositions } from "@/contexts/company-compatibility/infrastructure/seed/seed-positions"
import { verifyCompanyMigration } from "@/api/test/support/verify-company-migration"
import { contextStorage } from "hono/context-storage"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"

const jwtSecret = "employee-detail-route-test-secret"

const employeeResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string(),
  status: z.string(),
  role: z.string(),
})

/**
 * app.ts を編集せずに検証するため、対象ルートだけを同じミドルウェア構成で組み立てた検証用アプリ。
 * モジュール評価順に依存しないよう、ルート登録は呼び出し時に遅延構築する。
 */
function buildTestApp() {
  return factory
    .createApp()
    .use("*", contextStorage())
    .use("*", databaseMiddleware)
    .use("*", requestContextMiddleware)
    .onError((error, c) => {
      if (error instanceof HTTPException) {
        return c.json({ error: error.message }, error.status)
      }

      return c.json({ error: "internal server error" }, 500)
    })
    .get("/employees", ...employeeListRoute.GET)
    .post("/employees", ...employeeListRoute.POST)
    .get("/employees/:code", ...employeeDetailRoute.GET)
    .put("/employees/:code", ...employeeDetailRoute.PUT)
    .delete("/employees/:code", ...employeeDetailRoute.DELETE)
}

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
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "position_definitions",
    seedPositions.map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
    })),
  )

  await verifyCompanyMigration(db)

  return db
}

async function markCompanyMigrationPending(db: D1Database): Promise<void> {
  await db.prepare("UPDATE lifecycle_migration_states SET status = 'pending' WHERE id = 1").run()
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

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
  })
}

function organizationManagerWithoutCapabilityToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 9,
    email: "you+e009@example.com",
    role: "member",
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
  setup?: (db: D1Database) => Promise<void>,
): Promise<Response> {
  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const db = await createTestDb()

  if (setup !== undefined) {
    await setup(db)
  }

  const bindings: Bindings = {
    DB: db,
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
    NOW: "2026-01-01T00:00:00.000Z",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
  }

  return buildTestApp().request(
    path,
    {
      method: method ?? "GET",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  )
}

describe("GET /employees/:code", () => {
  test("returns 200 with another employee for employee:read holder", async () => {
    const response = await request("/employees/E001", await adminToken())

    expect(response.status).toBe(200)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("E001")
      expect(parsed.data.name).toBe("Alex Carter")
    }
  })

  test("never leaks passwordHash or id", async () => {
    const response = await request("/employees/E001", await adminToken())

    const parsed = z.record(z.string(), z.unknown()).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect("passwordHash" in parsed.data).toBe(false)
      expect("id" in parsed.data).toBe(false)
    }
  })

  test("returns 200 for a member reading their own employee record", async () => {
    const response = await request("/employees/E005", await memberToken())

    expect(response.status).toBe(200)
  })

  test("employee:read holder reads a managed employee detail", async () => {
    const response = await request("/employees/E005", await managerToken())

    expect(response.status).toBe(200)
  })

  test("employee:read holder cannot read an employee outside their organization scope", async () => {
    const response = await request("/employees/E009", await managerToken())

    expect(response.status).toBe(404)
  })

  test("conceals another employee record from a member without employee:read", async () => {
    const response = await request("/employees/E001", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/employees/E001", null)

    expect(response.status).toBe(401)
  })

  // このテスト用アプリの onError は message だけを返すため code は検証しない（status のみ）
  test("fails closed when lifecycle data is not verified", async () => {
    const response = await request(
      "/employees/E001?as_of=2026-01-01",
      await adminToken(),
      undefined,
      undefined,
      markCompanyMigrationPending,
    )

    expect(response.status).toBe(503)
  })

  test("does not fall back when as_of is omitted", async () => {
    const response = await request(
      "/employees/E001",
      await adminToken(),
      undefined,
      undefined,
      markCompanyMigrationPending,
    )

    expect(response.status).toBe(503)
  })

  test("honors as_of instead of rejecting it once lifecycle data is verified", async () => {
    const response = await request(
      "/employees/E001?as_of=2026-01-01",
      await adminToken(),
      undefined,
      undefined,
    )

    expect(response.status).toBe(200)
  })

  test("conceals lifecycle migration state from an out-of-scope caller instead of returning 422", async () => {
    const response = await request("/employees/E009?as_of=2026-01-01", await managerToken())

    expect(response.status).toBe(404)
  })
})

describe("POST /employees", () => {
  const newEmployee = {
    code: "E900",
    name: "Sam Rivers",
    email: "you+e900@example.com",
    password: "InitialPassword1",
    role: "member",
    hire_on: "2026-01-01",
    department_code: null,
    position_code: null,
    manager_employee_code: null,
  }

  test("admin creates an employee and gets 201", async () => {
    const response = await request("/employees", await adminToken(), "POST", newEmployee)

    expect(response.status).toBe(201)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("E900")
      expect(parsed.data.dept_name).toBeNull()
      expect(parsed.data.status).toBe("active")
    }
  })

  test("member cannot create and gets 403", async () => {
    const response = await request("/employees", await memberToken(), "POST", newEmployee)

    expect(response.status).toBe(403)
  })

  test("returns 409 on duplicate code", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      code: "E001",
    })

    expect(response.status).toBe(409)
  })

  test("returns 422 for an unknown position_code", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      department_code: "D003",
      position_code: "NO_SUCH_POSITION",
    })

    expect(response.status).toBe(422)
  })

  test("returns 422 when position_code is given without a department_code", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      department_code: null,
      position_code: "SENIOR_ENGINEER",
    })

    expect(response.status).toBe(422)
  })

  test("returns 400 when hire date is invalid", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      hire_on: "2026-02-30",
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when the password is shorter than 8 characters", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      password: "short7!",
    })

    expect(response.status).toBe(400)
  })

  test("rejects unknown fields instead of silently accepting lifecycle compatibility updates", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      code: "E901",
      status: "retired",
    })

    expect(response.status).toBe(400)
  })
})

describe("PUT /employees/:code", () => {
  const profileE4 = { name: "Drew Sato" }
  const profileE5 = { name: "Emery Lane" }

  test("admin updates an employee name without bypassing lifecycle data and gets 200", async () => {
    const response = await request("/employees/E004", await adminToken(), "PUT", {
      name: "Drew Sato Updated",
    })

    expect(response.status).toBe(200)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Drew Sato Updated")
      expect(parsed.data.position).toBe("開発マネージャー")
      expect(parsed.data.role).toBe("manager")
    }
  })

  test("member cannot update and gets 403", async () => {
    const response = await request("/employees/E004", await memberToken(), "PUT", profileE4)

    expect(response.status).toBe(403)
  })

  test("manager updates an employee inside their organization scope", async () => {
    const response = await request("/employees/E005", await managerToken(), "PUT", profileE5)

    expect(response.status).toBe(200)
  })

  test("employee:update alone cannot update outside the manager organization scope", async () => {
    const response = await request("/employees/E009", await managerToken(), "PUT", profileE4)

    expect(response.status).toBe(403)
  })

  test("org:manage allows a capability holder to update without an organization relationship", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 17,
      email: "you+e017@example.com",
      role: "hr",
    })
    const response = await request("/employees/E005", token, "PUT", profileE5, async (db) => {
      await db
        .prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           SELECT 'test:17:' || role.id, '17', role.id, NULL, NULL, 0, NULL
           FROM system_iam_roles AS role WHERE role.key = 'company:hr'`,
        )
        .run()
    })

    expect(response.status).toBe(200)
  })

  test("organization relationship alone cannot update without employee:update", async () => {
    const response = await request(
      "/employees/E010",
      await organizationManagerWithoutCapabilityToken(),
      "PUT",
      profileE4,
    )

    expect(response.status).toBe(403)
  })

  test("employee:update holder can update their own employee record", async () => {
    const response = await request("/employees/E004", await managerToken(), "PUT", profileE4)

    expect(response.status).toBe(200)
  })

  test("member cannot update their own employee record without employee:update", async () => {
    const response = await request("/employees/E005", await memberToken(), "PUT", profileE5)

    expect(response.status).toBe(403)
  })

  test("returns 401 for update without a bearer token", async () => {
    const response = await request("/employees/E005", null, "PUT", profileE5)

    expect(response.status).toBe(401)
  })

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await adminToken(), "PUT", profileE4)

    expect(response.status).toBe(404)
  })

  test("rejects lifecycle and IAM fields instead of silently mutating them", async () => {
    const response = await request("/employees/E001", await adminToken(), "PUT", {
      name: "Alex Carter",
      status: "retired",
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /employees/:code", () => {
  test("admin is directed to the history-preserving archive operation", async () => {
    const response = await request("/employees/E004", await adminToken(), "DELETE")

    expect(response.status).toBe(409)
  })

  test("member cannot delete and gets 403", async () => {
    const response = await request("/employees/E004", await memberToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("admin cannot physically delete their own account", async () => {
    const response = await request("/employees/E001", await adminToken(), "DELETE")

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })
})
