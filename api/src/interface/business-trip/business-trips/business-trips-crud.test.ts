import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedBusinessTrips } from "@/infrastructure/seed/seed-business-trips"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { factory } from "@/lib/factory"
import * as createRoute from "@/interface/business-trip/business-trips/route"
import * as detailRoute from "@/interface/business-trip/business-trips/[id]/route"
import * as meRoute from "@/interface/business-trip/business-trips/me/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// business-trip のハンドラだけを載せて検証する。me は :id より前に並べる。
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
  .post("/business-trips", ...createRoute.POST)
  .get("/business-trips/me", ...meRoute.GET)
  .get("/business-trips/:id", ...detailRoute.GET)
  .put("/business-trips/:id", ...detailRoute.PUT)
  .delete("/business-trips/:id", ...detailRoute.DELETE)

const businessTripResponseSchema = z.object({
  id: z.string(),
  traveler_id: z.number(),
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string(),
  estimated_cost: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "business-trips-crud-test-secret"

const ownBusinessTripId = "10000000-0000-0000-0000-000000000002"

const othersBusinessTripId = "10000000-0000-0000-0000-000000000001"

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
    "business_trips",
    seedBusinessTrips.map((businessTrip) => ({
      id: businessTrip.id,
      traveler_id: businessTrip.travelerId,
      destination: businessTrip.destination,
      start_date: businessTrip.startDate,
      end_date: businessTrip.endDate,
      purpose: businessTrip.purpose,
      estimated_cost: businessTrip.estimatedCost,
      status: businessTrip.status,
      created_at: businessTrip.createdAt,
    })),
  )

  return db
}

function travelerToken(): Promise<string> {
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

describe("POST /business-trips", () => {
  test("creates a business trip with status requested", async () => {
    const response = await request({
      path: "/business-trips",
      token: await travelerToken(),
      method: "POST",
      body: {
        destination: "Nagoya Branch",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        purpose: "Customer kickoff",
        estimated_cost: 22000,
      },
    })

    expect(response.status).toBe(201)

    const parsed = businessTripResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.traveler_id).toBe(4)
      expect(parsed.data.estimated_cost).toBe(22000)
    }
  })

  test("creates a business trip with null estimated_cost", async () => {
    const response = await request({
      path: "/business-trips",
      token: await travelerToken(),
      method: "POST",
      body: {
        destination: "Sendai Site",
        start_date: "2026-08-10",
        end_date: "2026-08-11",
        purpose: "Audit support",
      },
    })

    expect(response.status).toBe(201)

    const parsed = businessTripResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.estimated_cost).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/business-trips",
      token: null,
      method: "POST",
      body: {
        destination: "Nagoya Branch",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        purpose: "Customer kickoff",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /business-trips/me", () => {
  test("returns only the viewer's business trips", async () => {
    const response = await request({ path: "/business-trips/me", token: await travelerToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(businessTripResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].traveler_id).toBe(4)
    }
  })

  test("applies limit and offset to the listing", async () => {
    // 同一 DB に 2 件目を作成し、limit が件数を絞り offset が先頭を飛ばすことを検証する。
    const db = await createTestDb()

    const token = await travelerToken()

    const bindings = { DB: db, JWT_SECRET: jwtSecret, NOW: "2026-01-01T00:00:00.000Z" }

    const created = await app.request(
      "/business-trips",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          destination: "Nagoya Branch",
          start_date: "2026-08-01",
          end_date: "2026-08-02",
          purpose: "Customer kickoff",
          estimated_cost: 22000,
        }),
      },
      bindings,
    )

    expect(created.status).toBe(201)

    const limited = await app.request(
      "/business-trips/me?limit=1",
      { headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    const limitedRows = z
      .object({ data: z.array(businessTripResponseSchema), total: z.number() })
      .parse(await limited.json())

    expect(limitedRows.data.length).toBe(1)

    const skipped = await app.request(
      "/business-trips/me?offset=1",
      { headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    const skippedRows = z
      .object({ data: z.array(businessTripResponseSchema), total: z.number() })
      .parse(await skipped.json())

    expect(skippedRows.data.length).toBe(1)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/business-trips/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /business-trips/:id", () => {
  test("returns the business trip for its traveler", async () => {
    const response = await request({
      path: `/business-trips/${ownBusinessTripId}`,
      token: await travelerToken(),
    })

    expect(response.status).toBe(200)

    const parsed = businessTripResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownBusinessTripId)
    }
  })

  test("returns 403 for another person's business trip", async () => {
    const response = await request({
      path: `/business-trips/${othersBusinessTripId}`,
      token: await travelerToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown business trip", async () => {
    const response = await request({
      path: "/business-trips/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await travelerToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /business-trips/:id", () => {
  test("updates the details of the viewer's business trip", async () => {
    const response = await request({
      path: `/business-trips/${ownBusinessTripId}`,
      token: await travelerToken(),
      method: "PUT",
      body: {
        destination: "Sapporo HQ",
        start_date: "2026-06-21",
        end_date: "2026-06-23",
        purpose: "Revised inspection plan",
        estimated_cost: 50000,
      },
    })

    expect(response.status).toBe(200)

    const parsed = businessTripResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.destination).toBe("Sapporo HQ")
      expect(parsed.data.estimated_cost).toBe(50000)
    }
  })

  test("returns 403 when updating another person's business trip", async () => {
    const response = await request({
      path: `/business-trips/${othersBusinessTripId}`,
      token: await travelerToken(),
      method: "PUT",
      body: {
        destination: "Sapporo HQ",
        start_date: "2026-06-21",
        end_date: "2026-06-23",
        purpose: "Revised inspection plan",
        estimated_cost: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown business trip", async () => {
    const response = await request({
      path: "/business-trips/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await travelerToken(),
      method: "PUT",
      body: {
        destination: "Sapporo HQ",
        start_date: "2026-06-21",
        end_date: "2026-06-23",
        purpose: "Revised inspection plan",
        estimated_cost: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /business-trips/:id", () => {
  test("cancels the viewer's business trip and returns 204", async () => {
    const response = await request({
      path: `/business-trips/${ownBusinessTripId}`,
      token: await travelerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's business trip", async () => {
    const response = await request({
      path: `/business-trips/${othersBusinessTripId}`,
      token: await travelerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown business trip", async () => {
    const response = await request({
      path: "/business-trips/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await travelerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/business-trips/${ownBusinessTripId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
