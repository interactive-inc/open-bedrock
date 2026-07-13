import { describe, expect, test } from "bun:test"
import type { Bindings } from "@/env"
import * as employeeDetailRoute from "@/interface/employee/[code]/route"
import * as employeeListRoute from "@/interface/employee/route"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { factory } from "@/lib/factory"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
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

// app.ts を編集せずに検証するため、対象ルートだけを同じミドルウェア構成で組み立てた検証用アプリ。
// モジュール評価順に依存しないよう、ルート登録は呼び出し時に遅延構築する。
function buildTestApp() {
  return factory
    .createApp()
    .use("*", contextStorage())
    .use("*", databaseMiddleware)
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
})

describe("POST /employees", () => {
  const newEmployee = {
    code: "E900",
    name: "Sam Rivers",
    email: "you+e900@example.com",
    password: "initial-password",
    role: "member",
    dept_id: 3,
    dept_name: "Engineering",
    position: "Engineer",
    status: "active",
  }

  test("admin creates an employee and gets 201", async () => {
    const response = await request("/employees", await adminToken(), "POST", newEmployee)

    expect(response.status).toBe(201)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("E900")
      expect(parsed.data.dept_name).toBe("Engineering")
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

  test("returns 400 when status is outside the allowed set", async () => {
    const response = await request("/employees", await adminToken(), "POST", {
      ...newEmployee,
      status: "unknown",
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
})

describe("PUT /employees/:code", () => {
  const profile = {
    name: "Drew Sato",
    email: "you+e004@example.com",
    role: "manager",
    dept_id: 3,
    dept_name: "Engineering",
    position: "Engineering Director",
    status: "active",
  }

  test("admin updates an employee and gets 200", async () => {
    const response = await request("/employees/E004", await adminToken(), "PUT", profile)

    expect(response.status).toBe(200)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.position).toBe("Engineering Director")
      expect(parsed.data.role).toBe("manager")
    }
  })

  test("member cannot update and gets 403", async () => {
    const response = await request("/employees/E004", await memberToken(), "PUT", profile)

    expect(response.status).toBe(403)
  })

  test("manager updates an employee inside their organization scope", async () => {
    const response = await request("/employees/E005", await managerToken(), "PUT", profile)

    expect(response.status).toBe(200)
  })

  test("employee:update alone cannot update outside the manager organization scope", async () => {
    const response = await request("/employees/E009", await managerToken(), "PUT", profile)

    expect(response.status).toBe(403)
  })

  test("org:manage allows a capability holder to update without an organization relationship", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 17,
      email: "you+e017@example.com",
      role: "hr",
    })
    const response = await request("/employees/E005", token, "PUT", profile, async (db) => {
      await db
        .prepare(
          `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
           SELECT 17, id, NULL, 0 FROM roles WHERE key = 'hr'`,
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
      profile,
    )

    expect(response.status).toBe(403)
  })

  test("employee:update holder can update their own employee record", async () => {
    const response = await request("/employees/E004", await managerToken(), "PUT", profile)

    expect(response.status).toBe(200)
  })

  test("member cannot update their own employee record without employee:update", async () => {
    const response = await request("/employees/E005", await memberToken(), "PUT", profile)

    expect(response.status).toBe(403)
  })

  test("returns 401 for update without a bearer token", async () => {
    const response = await request("/employees/E005", null, "PUT", profile)

    expect(response.status).toBe(401)
  })

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await adminToken(), "PUT", profile)

    expect(response.status).toBe(404)
  })

  test("returns 409 when retiring the last admin", async () => {
    const response = await request("/employees/E001", await adminToken(), "PUT", {
      name: "Alex Carter",
      dept_id: 1,
      dept_name: "Corporate Planning",
      position: "CTO",
      status: "retired",
    })

    expect(response.status).toBe(409)
  })
})

describe("DELETE /employees/:code", () => {
  test("admin deletes an employee and gets 204", async () => {
    const response = await request("/employees/E004", await adminToken(), "DELETE")

    expect(response.status).toBe(204)
  })

  test("member cannot delete and gets 403", async () => {
    const response = await request("/employees/E004", await memberToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("admin cannot delete their own account and gets 403", async () => {
    const response = await request("/employees/E001", await adminToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })
})
