import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedAntisocialChecks } from "@/infrastructure/seed/seed-antisocial-checks"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { factory } from "@/lib/factory"
import * as createRoute from "@/interface/antisocial-check/antisocial-checks/route"
import * as detailRoute from "@/interface/antisocial-check/antisocial-checks/[id]/route"
import * as meRoute from "@/interface/antisocial-check/antisocial-checks/me/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// antisocial-check のハンドラだけを載せて検証する。me は :id より前に並べる。
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
  .post("/antisocial-checks", ...createRoute.POST)
  .get("/antisocial-checks/me", ...meRoute.GET)
  .get("/antisocial-checks/:id", ...detailRoute.GET)
  .put("/antisocial-checks/:id", ...detailRoute.PUT)
  .delete("/antisocial-checks/:id", ...detailRoute.DELETE)

const antisocialCheckResponseSchema = z.object({
  id: z.string(),
  requester_id: z.number(),
  partner_name: z.string(),
  partner_address: z.string().nullable(),
  representative_name: z.string().nullable(),
  result: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "antisocial-checks-crud-test-secret"

const ownAntisocialCheckId = "20000000-0000-0000-0000-000000000002"

const othersAntisocialCheckId = "20000000-0000-0000-0000-000000000001"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "antisocial_checks",
    seedAntisocialChecks.map((antisocialCheck) => ({
      id: antisocialCheck.id,
      requester_id: antisocialCheck.requesterId,
      partner_name: antisocialCheck.partnerName,
      partner_address: antisocialCheck.partnerAddress,
      representative_name: antisocialCheck.representativeName,
      result: antisocialCheck.result,
      status: antisocialCheck.status,
      created_at: antisocialCheck.createdAt,
    })),
  )

  return db
}

function requesterToken(): Promise<string> {
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

describe("POST /antisocial-checks", () => {
  test("creates an antisocial check with status requested", async () => {
    const response = await request({
      path: "/antisocial-checks",
      token: await requesterToken(),
      method: "POST",
      body: {
        partner_name: "Example Trading Co.",
        partner_address: "1-2-3 Sample, Example City",
        representative_name: "Pat Example",
      },
    })

    expect(response.status).toBe(201)

    const parsed = antisocialCheckResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.requester_id).toBe(4)
      expect(parsed.data.result).toBe(null)
    }
  })

  test("creates an antisocial check with null optional fields", async () => {
    const response = await request({
      path: "/antisocial-checks",
      token: await requesterToken(),
      method: "POST",
      body: {
        partner_name: "Sample Logistics Inc.",
      },
    })

    expect(response.status).toBe(201)

    const parsed = antisocialCheckResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.partner_address).toBe(null)
      expect(parsed.data.representative_name).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/antisocial-checks",
      token: null,
      method: "POST",
      body: {
        partner_name: "Example Trading Co.",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /antisocial-checks/me", () => {
  test("returns only the viewer's antisocial checks", async () => {
    const response = await request({ path: "/antisocial-checks/me", token: await requesterToken() })

    expect(response.status).toBe(200)

    const parsed = z.array(antisocialCheckResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0].requester_id).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/antisocial-checks/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /antisocial-checks/:id", () => {
  test("returns the antisocial check for its requester", async () => {
    const response = await request({
      path: `/antisocial-checks/${ownAntisocialCheckId}`,
      token: await requesterToken(),
    })

    expect(response.status).toBe(200)

    const parsed = antisocialCheckResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownAntisocialCheckId)
    }
  })

  test("returns 403 for another person's antisocial check", async () => {
    const response = await request({
      path: `/antisocial-checks/${othersAntisocialCheckId}`,
      token: await requesterToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown antisocial check", async () => {
    const response = await request({
      path: "/antisocial-checks/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /antisocial-checks/:id", () => {
  test("updates the details and result of the viewer's antisocial check", async () => {
    const response = await request({
      path: `/antisocial-checks/${ownAntisocialCheckId}`,
      token: await requesterToken(),
      method: "PUT",
      body: {
        partner_name: "Demo Partners LLC",
        partner_address: "4-5-6 Placeholder, Example City",
        representative_name: "Alex Sample",
        result: "clear",
      },
    })

    expect(response.status).toBe(200)

    const parsed = antisocialCheckResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.partner_name).toBe("Demo Partners LLC")
      expect(parsed.data.result).toBe("clear")
    }
  })

  test("returns 403 when updating another person's antisocial check", async () => {
    const response = await request({
      path: `/antisocial-checks/${othersAntisocialCheckId}`,
      token: await requesterToken(),
      method: "PUT",
      body: {
        partner_name: "Demo Partners LLC",
        partner_address: null,
        representative_name: null,
        result: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown antisocial check", async () => {
    const response = await request({
      path: "/antisocial-checks/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
      method: "PUT",
      body: {
        partner_name: "Demo Partners LLC",
        partner_address: null,
        representative_name: null,
        result: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /antisocial-checks/:id", () => {
  test("cancels the viewer's antisocial check and returns 204", async () => {
    const response = await request({
      path: `/antisocial-checks/${ownAntisocialCheckId}`,
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's antisocial check", async () => {
    const response = await request({
      path: `/antisocial-checks/${othersAntisocialCheckId}`,
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown antisocial check", async () => {
    const response = await request({
      path: "/antisocial-checks/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/antisocial-checks/${ownAntisocialCheckId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
