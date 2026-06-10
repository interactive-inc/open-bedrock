import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedYearEndAdjustments } from "@/infrastructure/seed/seed-year-end-adjustments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { factory } from "@/lib/factory"
import * as createRoute from "@/interface/year-end-adjustment/year-end-adjustments/route"
import * as detailRoute from "@/interface/year-end-adjustment/year-end-adjustments/[id]/route"
import * as meRoute from "@/interface/year-end-adjustment/year-end-adjustments/me/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// year-end-adjustment のハンドラだけを載せて検証する。me は :id より前に並べる。
const app = factory
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
  .post("/year-end-adjustments", ...createRoute.POST)
  .get("/year-end-adjustments/me", ...meRoute.GET)
  .get("/year-end-adjustments/:id", ...detailRoute.GET)
  .put("/year-end-adjustments/:id", ...detailRoute.PUT)
  .delete("/year-end-adjustments/:id", ...detailRoute.DELETE)

const yearEndAdjustmentResponseSchema = z.object({
  id: z.string(),
  employee_id: z.number(),
  target_year: z.number(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "year-end-adjustments-crud-test-secret"

const ownAdjustmentId = "20000000-0000-0000-0000-000000000002"

const othersAdjustmentId = "20000000-0000-0000-0000-000000000001"

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
    "year_end_adjustments",
    seedYearEndAdjustments.map((yearEndAdjustment) => ({
      id: yearEndAdjustment.id,
      employee_id: yearEndAdjustment.employeeId,
      target_year: yearEndAdjustment.targetYear,
      note: yearEndAdjustment.note,
      status: yearEndAdjustment.status,
      created_at: yearEndAdjustment.createdAt,
    })),
  )

  return db
}

function applicantToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
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

  return app.request(
    props.path,
    {
      method: props.method ?? "GET",
      headers,
      body: props.body === undefined ? undefined : JSON.stringify(props.body),
    },
    {
      DB: await createTestDb(),
      JWT_SECRET: jwtSecret,
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("POST /year-end-adjustments", () => {
  test("creates a year end adjustment with status submitted", async () => {
    const response = await request({
      path: "/year-end-adjustments",
      token: await applicantToken(),
      method: "POST",
      body: {
        target_year: 2025,
        note: "Submitted with deduction documents",
      },
    })

    expect(response.status).toBe(201)

    const parsed = yearEndAdjustmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("submitted")
      expect(parsed.data.employee_id).toBe(4)
      expect(parsed.data.target_year).toBe(2025)
    }
  })

  test("creates a year end adjustment with null note", async () => {
    const response = await request({
      path: "/year-end-adjustments",
      token: await applicantToken(),
      method: "POST",
      body: {
        target_year: 2025,
      },
    })

    expect(response.status).toBe(201)

    const parsed = yearEndAdjustmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.note).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/year-end-adjustments",
      token: null,
      method: "POST",
      body: {
        target_year: 2025,
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /year-end-adjustments/me", () => {
  test("returns only the viewer's year end adjustments", async () => {
    const response = await request({
      path: "/year-end-adjustments/me",
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(yearEndAdjustmentResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0].employee_id).toBe(4)
    }
  })

  test("applies limit and offset to the listing", async () => {
    const limited = await request({
      path: "/year-end-adjustments/me?limit=1",
      token: await applicantToken(),
    })

    const limitedRows = z.array(yearEndAdjustmentResponseSchema).parse(await limited.json())

    expect(limitedRows.length).toBe(1)

    const skipped = await request({
      path: "/year-end-adjustments/me?offset=1",
      token: await applicantToken(),
    })

    const skippedRows = z.array(yearEndAdjustmentResponseSchema).parse(await skipped.json())

    expect(skippedRows.length).toBe(0)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/year-end-adjustments/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /year-end-adjustments/:id", () => {
  test("returns the year end adjustment for its applicant", async () => {
    const response = await request({
      path: `/year-end-adjustments/${ownAdjustmentId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = yearEndAdjustmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownAdjustmentId)
    }
  })

  test("returns 403 for another person's year end adjustment", async () => {
    const response = await request({
      path: `/year-end-adjustments/${othersAdjustmentId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown year end adjustment", async () => {
    const response = await request({
      path: "/year-end-adjustments/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /year-end-adjustments/:id", () => {
  test("updates the details of the viewer's year end adjustment", async () => {
    const response = await request({
      path: `/year-end-adjustments/${ownAdjustmentId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        target_year: 2024,
        note: "Revised remarks",
      },
    })

    expect(response.status).toBe(200)

    const parsed = yearEndAdjustmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.target_year).toBe(2024)
      expect(parsed.data.note).toBe("Revised remarks")
    }
  })

  test("returns 403 when updating another person's year end adjustment", async () => {
    const response = await request({
      path: `/year-end-adjustments/${othersAdjustmentId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        target_year: 2024,
        note: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown year end adjustment", async () => {
    const response = await request({
      path: "/year-end-adjustments/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "PUT",
      body: {
        target_year: 2024,
        note: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /year-end-adjustments/:id", () => {
  test("cancels the viewer's year end adjustment and returns 204", async () => {
    const response = await request({
      path: `/year-end-adjustments/${ownAdjustmentId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's year end adjustment", async () => {
    const response = await request({
      path: `/year-end-adjustments/${othersAdjustmentId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown year end adjustment", async () => {
    const response = await request({
      path: "/year-end-adjustments/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/year-end-adjustments/${ownAdjustmentId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
