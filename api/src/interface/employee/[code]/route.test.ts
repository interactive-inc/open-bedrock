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

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: await createTestDb(),
    JWT_SECRET: jwtSecret,
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
  test("returns 200 with the employee", async () => {
    const response = await request("/employees/E001", await memberToken())

    expect(response.status).toBe(200)

    const parsed = employeeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("E001")
      expect(parsed.data.name).toBe("Alex Carter")
    }
  })

  test("never leaks passwordHash or id", async () => {
    const response = await request("/employees/E001", await memberToken())

    const parsed = z.record(z.string(), z.unknown()).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect("passwordHash" in parsed.data).toBe(false)
      expect("id" in parsed.data).toBe(false)
    }
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

  test("returns 404 for a missing employee", async () => {
    const response = await request("/employees/E999", await adminToken(), "PUT", profile)

    expect(response.status).toBe(404)
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
