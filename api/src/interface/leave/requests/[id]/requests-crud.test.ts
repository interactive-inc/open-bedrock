import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedLeaveRequests } from "@/infrastructure/seed/seed-leave-requests"
import * as leaveRequestDetailRoute from "@/interface/leave/requests/[id]/route"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import type { Bindings } from "@/env"
import { factory } from "@/lib/factory"
import { z } from "zod"

const leaveRequestResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

const jwtSecret = "leave-requests-crud-test-secret"

// app.ts を編集せずに自ドメインの :id ルートだけを載せたテスト用アプリ。
const testApp = factory
  .createApp()
  .use("*", cors())
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .get("/leave/requests/:id", ...leaveRequestDetailRoute.GET)
  .put("/leave/requests/:id", ...leaveRequestDetailRoute.PUT)
  .delete("/leave/requests/:id", ...leaveRequestDetailRoute.DELETE)

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
    "leave_requests",
    seedLeaveRequests.map((leaveRequest) => ({
      id: leaveRequest.id,
      employee_id: leaveRequest.employeeId,
      leave_type: leaveRequest.leaveType,
      start_date: leaveRequest.startDate,
      end_date: leaveRequest.endDate,
      days: leaveRequest.days,
      reason: leaveRequest.reason,
      status: leaveRequest.status,
      approver_id: leaveRequest.approverId,
      decided_comment: leaveRequest.decidedComment,
      created_at: leaveRequest.createdAt,
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

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  const headers: Record<string, string> = {}

  if (props.token !== null) {
    headers.Authorization = `Bearer ${props.token}`
  }

  if (props.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: await createTestDb(),
    JWT_SECRET: jwtSecret,
    NOW: "2026-01-01T00:00:00.000Z",
  }

  return testApp.request(
    props.path,
    {
      method: props.method ?? "GET",
      headers,
      body: props.body === undefined ? undefined : JSON.stringify(props.body),
    },
    bindings,
  )
}

describe("GET /leave/requests/:id", () => {
  test("returns the request for its applicant", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = leaveRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.employee_id).toBe(5)
    }
  })

  test("returns 403 for another person's request", async () => {
    const response = await request({
      path: "/leave/requests/2",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/leave/requests/9999",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/leave/requests/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /leave/requests/:id", () => {
  test("revises a pending request for its applicant", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: {
        leave_type: "special",
        start_date: "2026-06-05",
        end_date: "2026-06-06",
        reason: "revised",
      },
    })

    expect(response.status).toBe(200)

    const parsed = leaveRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.leave_type).toBe("special")
      expect(parsed.data.days).toBe(2)
      expect(parsed.data.reason).toBe("revised")
    }
  })

  test("allows revising into a period that overlaps only the request itself", async () => {
    // 申請1 (06-01..06-03) を自分自身と重なる 06-02..06-04 へ更新。
    // 自己除外 (excludeId) が無いと自分にヒットして 409 になってしまう。
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: {
        leave_type: "annual",
        start_date: "2026-06-02",
        end_date: "2026-06-04",
        reason: null,
      },
    })

    expect(response.status).toBe(200)
  })

  test("returns 409 when revising into another pending request's period", async () => {
    const db = await createTestDb()

    // employee 5 に別期間の pending をもう 1 件追加する。
    await seedD1(db, "leave_requests", [
      {
        id: 100,
        employee_id: 5,
        leave_type: "annual",
        start_date: "2026-07-01",
        end_date: "2026-07-03",
        days: 3,
        reason: null,
        status: "pending",
        approver_id: null,
        decided_comment: null,
        created_at: "2026-05-20T00:00:00Z",
      },
    ])

    const bindings: Bindings = {
      DB: db,
      JWT_SECRET: jwtSecret,
      NOW: "2026-01-01T00:00:00.000Z",
    }

    // 申請1 を 07-02..07-04 へ変更すると申請100 と重複する → 409。
    const response = await testApp.request(
      "/leave/requests/1",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${await tokenFor(5, "member")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          leave_type: "annual",
          start_date: "2026-07-02",
          end_date: "2026-07-04",
          reason: null,
        }),
      },
      bindings,
    )

    expect(response.status).toBe(409)
  })

  test("returns 409 when revising a decided request", async () => {
    const response = await request({
      path: "/leave/requests/2",
      token: await tokenFor(10, "member"),
      method: "PUT",
      body: {
        leave_type: "annual",
        start_date: "2026-07-10",
        end_date: "2026-07-11",
        reason: null,
      },
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 when revising another person's request", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(10, "member"),
      method: "PUT",
      body: {
        leave_type: "annual",
        start_date: "2026-06-01",
        end_date: "2026-06-02",
        reason: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/leave/requests/9999",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: {
        leave_type: "annual",
        start_date: "2026-06-01",
        end_date: "2026-06-02",
        reason: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /leave/requests/:id", () => {
  test("withdraws a pending request and returns 204", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 409 when withdrawing a decided request", async () => {
    const response = await request({
      path: "/leave/requests/2",
      token: await tokenFor(10, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 when withdrawing another person's request", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: await tokenFor(10, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/leave/requests/9999",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/leave/requests/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
