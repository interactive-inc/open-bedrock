import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedResignations } from "@/contexts/resignation/test/seed/seed-resignations.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { databaseMiddleware } from "@/api/database-middleware"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { factory } from "@/api/http/factory"
import * as createRoute from "@/contexts/resignation/interface/routes/resignations"
import * as detailRoute from "@/contexts/resignation/interface/routes/resignations.$id"
import * as meRoute from "@/contexts/resignation/interface/routes/resignations.me"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

/**
 * app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
 * resignation のハンドラだけを載せて検証する。me は :id より前に並べる。
 */
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
  .post("/resignations", ...createRoute.POST)
  .get("/resignations/me", ...meRoute.GET)
  .get("/resignations/:id", ...detailRoute.GET)
  .put("/resignations/:id", ...detailRoute.PUT)
  .delete("/resignations/:id", ...detailRoute.DELETE)

const resignationResponseSchema = z.object({
  id: z.string(),
  employee_id: zEmployeeId,
  resignation_date: z.string(),
  last_working_date: z.string().nullable(),
  reason: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "resignations-crud-test-secret"

const ownResignationId = "20000000-0000-0000-0000-000000000002"

const othersResignationId = "20000000-0000-0000-0000-000000000001"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "resignations",
    seedResignations.map((resignation) => ({
      id: resignation.id,
      employee_id: resignation.employeeId,
      resignation_date: resignation.resignationDate,
      last_working_date: resignation.lastWorkingDate,
      reason: resignation.reason,
      status: resignation.status,
      created_at: resignation.createdAt,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function applicantToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(4),
  })
}

/** Employee 5 has no pending resignation in seed data. */
function noPendingToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
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
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      COMPANY_TIME_ZONE: "Asia/Tokyo",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("POST /resignations", () => {
  test("creates a resignation with status requested", async () => {
    const response = await request({
      path: "/resignations",
      token: await noPendingToken(),
      method: "POST",
      body: {
        resignation_date: "2026-12-31",
        last_working_date: "2026-12-20",
        reason: "Career change",
      },
    })

    expect(response.status).toBe(201)

    const parsed = resignationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.last_working_date).toBe("2026-12-20")
    }
  })

  test("creates a resignation with null optional fields", async () => {
    const response = await request({
      path: "/resignations",
      token: await noPendingToken(),
      method: "POST",
      body: {
        resignation_date: "2026-12-31",
      },
    })

    expect(response.status).toBe(201)

    const parsed = resignationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.last_working_date).toBe(null)
      expect(parsed.data.reason).toBe(null)
    }
  })

  test("returns 409 when the employee already has a pending resignation", async () => {
    const response = await request({
      path: "/resignations",
      token: await applicantToken(),
      method: "POST",
      body: {
        resignation_date: "2026-12-31",
        reason: "Duplicate attempt",
      },
    })

    expect(response.status).toBe(409)
  })

  test("returns 400 when resignation_date is in the past", async () => {
    const response = await request({
      path: "/resignations",
      token: await noPendingToken(),
      method: "POST",
      body: {
        resignation_date: "2025-12-31",
        reason: "Past date attempt",
      },
    })

    expect(response.status).toBe(400)
  })

  test("accepts resignation_date equal to today", async () => {
    const response = await request({
      path: "/resignations",
      token: await noPendingToken(),
      method: "POST",
      body: {
        resignation_date: "2026-01-01",
      },
    })

    expect(response.status).toBe(201)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/resignations",
      token: null,
      method: "POST",
      body: {
        resignation_date: "2026-12-31",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /resignations/me", () => {
  test("returns only the viewer's resignations", async () => {
    const response = await request({ path: "/resignations/me", token: await applicantToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(resignationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].employee_id).toBe(toWorkforceEmployeeId(4))
    }
  })

  test("applies limit and offset to the listing", async () => {
    const limited = await request({
      path: "/resignations/me?limit=1",
      token: await applicantToken(),
    })

    const limitedRows = z
      .object({ data: z.array(resignationResponseSchema), total: z.number() })
      .parse(await limited.json())

    expect(limitedRows.data.length).toBe(1)

    const skipped = await request({
      path: "/resignations/me?offset=1",
      token: await applicantToken(),
    })

    const skippedRows = z
      .object({ data: z.array(resignationResponseSchema), total: z.number() })
      .parse(await skipped.json())

    expect(skippedRows.data.length).toBe(0)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/resignations/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /resignations/:id", () => {
  test("returns the resignation for its applicant", async () => {
    const response = await request({
      path: `/resignations/${ownResignationId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = resignationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownResignationId)
    }
  })

  test("returns 403 for another person's resignation", async () => {
    const response = await request({
      path: `/resignations/${othersResignationId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown resignation", async () => {
    const response = await request({
      path: "/resignations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /resignations/:id", () => {
  test("updates the details of the viewer's resignation", async () => {
    const response = await request({
      path: `/resignations/${ownResignationId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        resignation_date: "2026-11-30",
        last_working_date: "2026-11-20",
        reason: "Relocation",
      },
    })

    expect(response.status).toBe(200)

    const parsed = resignationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.resignation_date).toBe("2026-11-30")
      expect(parsed.data.reason).toBe("Relocation")
    }
  })

  test("returns 403 when updating another person's resignation", async () => {
    const response = await request({
      path: `/resignations/${othersResignationId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        resignation_date: "2026-11-30",
        last_working_date: null,
        reason: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown resignation", async () => {
    const response = await request({
      path: "/resignations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "PUT",
      body: {
        resignation_date: "2026-11-30",
        last_working_date: null,
        reason: null,
      },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when updating resignation_date to a past date", async () => {
    const response = await request({
      path: `/resignations/${ownResignationId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        resignation_date: "2025-06-01",
        last_working_date: null,
        reason: null,
      },
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /resignations/:id", () => {
  test("cancels the viewer's resignation and returns 204", async () => {
    const response = await request({
      path: `/resignations/${ownResignationId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's resignation", async () => {
    const response = await request({
      path: `/resignations/${othersResignationId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown resignation", async () => {
    const response = await request({
      path: "/resignations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/resignations/${ownResignationId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
