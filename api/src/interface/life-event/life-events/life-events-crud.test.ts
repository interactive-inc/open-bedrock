import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedLifeEvents } from "@/infrastructure/seed/seed-life-events"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { factory } from "@/lib/factory"
import * as createRoute from "@/interface/life-event/life-events/route"
import * as detailRoute from "@/interface/life-event/life-events/[id]/route"
import * as meRoute from "@/interface/life-event/life-events/me/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// life-event のハンドラだけを載せて検証する。me は :id より前に並べる。
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
  .post("/life-events", ...createRoute.POST)
  .get("/life-events/me", ...meRoute.GET)
  .get("/life-events/:id", ...detailRoute.GET)
  .put("/life-events/:id", ...detailRoute.PUT)
  .delete("/life-events/:id", ...detailRoute.DELETE)

const lifeEventResponseSchema = z.object({
  id: z.string(),
  employee_id: z.number(),
  event_type: z.string(),
  event_date: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "life-events-crud-test-secret"

const ownLifeEventId = "20000000-0000-0000-0000-000000000002"

const othersLifeEventId = "20000000-0000-0000-0000-000000000001"

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
    "life_events",
    seedLifeEvents.map((lifeEvent) => ({
      id: lifeEvent.id,
      employee_id: lifeEvent.employeeId,
      event_type: lifeEvent.eventType,
      event_date: lifeEvent.eventDate,
      detail: lifeEvent.detail,
      status: lifeEvent.status,
      created_at: lifeEvent.createdAt,
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
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("POST /life-events", () => {
  test("creates a life event with status submitted", async () => {
    const response = await request({
      path: "/life-events",
      token: await applicantToken(),
      method: "POST",
      body: {
        event_type: "marriage",
        event_date: "2026-08-01",
        detail: "氏名変更の手続きを予定",
      },
    })

    expect(response.status).toBe(201)

    const parsed = lifeEventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("submitted")
      expect(parsed.data.employee_id).toBe(4)
      expect(parsed.data.detail).toBe("氏名変更の手続きを予定")
    }
  })

  test("creates a life event with null detail", async () => {
    const response = await request({
      path: "/life-events",
      token: await applicantToken(),
      method: "POST",
      body: {
        event_type: "relocation",
        event_date: "2026-08-10",
      },
    })

    expect(response.status).toBe(201)

    const parsed = lifeEventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.detail).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/life-events",
      token: null,
      method: "POST",
      body: {
        event_type: "marriage",
        event_date: "2026-08-01",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /life-events/me", () => {
  test("returns only the viewer's life events", async () => {
    const response = await request({ path: "/life-events/me", token: await applicantToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(lifeEventResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].employee_id).toBe(4)
    }
  })

  test("applies limit and offset to the listing", async () => {
    // 同一 DB に 2 件目を作成し、limit が件数を絞り offset が先頭を飛ばすことを検証する。
    const db = await createTestDb()

    const token = await applicantToken()

    const bindings = {
      DB: db,
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    }

    const created = await app.request(
      "/life-events",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          event_type: "childbirth",
          event_date: "2026-09-01",
          detail: "第二子の出生届",
        }),
      },
      bindings,
    )

    expect(created.status).toBe(201)

    const limited = await app.request(
      "/life-events/me?limit=1",
      { headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    const limitedRows = z
      .object({ data: z.array(lifeEventResponseSchema), total: z.number() })
      .parse(await limited.json())

    expect(limitedRows.data.length).toBe(1)

    const skipped = await app.request(
      "/life-events/me?offset=1",
      { headers: { Authorization: `Bearer ${token}` } },
      bindings,
    )

    const skippedRows = z
      .object({ data: z.array(lifeEventResponseSchema), total: z.number() })
      .parse(await skipped.json())

    expect(skippedRows.data.length).toBe(1)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/life-events/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /life-events/:id", () => {
  test("returns the life event for its applicant", async () => {
    const response = await request({
      path: `/life-events/${ownLifeEventId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = lifeEventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownLifeEventId)
    }
  })

  test("returns 403 for another person's life event", async () => {
    const response = await request({
      path: `/life-events/${othersLifeEventId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown life event", async () => {
    const response = await request({
      path: "/life-events/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /life-events/:id", () => {
  test("updates the details of the viewer's life event", async () => {
    const response = await request({
      path: `/life-events/${ownLifeEventId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        event_type: "childbirth",
        event_date: "2026-06-21",
        detail: "扶養変更の届出を予定",
      },
    })

    expect(response.status).toBe(200)

    const parsed = lifeEventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.event_type).toBe("childbirth")
      expect(parsed.data.detail).toBe("扶養変更の届出を予定")
    }
  })

  test("returns 403 when updating another person's life event", async () => {
    const response = await request({
      path: `/life-events/${othersLifeEventId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        event_type: "childbirth",
        event_date: "2026-06-21",
        detail: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown life event", async () => {
    const response = await request({
      path: "/life-events/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "PUT",
      body: {
        event_type: "childbirth",
        event_date: "2026-06-21",
        detail: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /life-events/:id", () => {
  test("cancels the viewer's life event and returns 204", async () => {
    const response = await request({
      path: `/life-events/${ownLifeEventId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's life event", async () => {
    const response = await request({
      path: `/life-events/${othersLifeEventId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown life event", async () => {
    const response = await request({
      path: "/life-events/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/life-events/${ownLifeEventId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
