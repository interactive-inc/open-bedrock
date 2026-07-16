import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedFamilyCareLeaves } from "@/infrastructure/seed/seed-family-care-leaves"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/interface/shared/database-middleware"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { factory } from "@/lib/factory"
import * as createRoute from "@/interface/family-care-leave/family-care-leaves/route"
import * as detailRoute from "@/interface/family-care-leave/family-care-leaves/[id]/route"
import * as meRoute from "@/interface/family-care-leave/family-care-leaves/me/route"
import { z } from "zod"

// app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
// family-care-leave のハンドラだけを載せて検証する。me は :id より前に並べる。
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
  .post("/family-care-leaves", ...createRoute.POST)
  .get("/family-care-leaves/me", ...meRoute.GET)
  .get("/family-care-leaves/:id", ...detailRoute.GET)
  .put("/family-care-leaves/:id", ...detailRoute.PUT)
  .delete("/family-care-leaves/:id", ...detailRoute.DELETE)

const familyCareLeaveResponseSchema = z.object({
  id: z.string(),
  employee_id: z.number(),
  leave_kind: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "family-care-leaves-crud-test-secret"

const ownFamilyCareLeaveId = "20000000-0000-0000-0000-000000000002"

const othersFamilyCareLeaveId = "20000000-0000-0000-0000-000000000001"

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
    "family_care_leaves",
    seedFamilyCareLeaves.map((familyCareLeave) => ({
      id: familyCareLeave.id,
      employee_id: familyCareLeave.employeeId,
      leave_kind: familyCareLeave.leaveKind,
      start_date: familyCareLeave.startDate,
      end_date: familyCareLeave.endDate,
      note: familyCareLeave.note,
      status: familyCareLeave.status,
      created_at: familyCareLeave.createdAt,
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

describe("POST /family-care-leaves", () => {
  test("creates a family care leave with status requested", async () => {
    const response = await request({
      path: "/family-care-leaves",
      token: await applicantToken(),
      method: "POST",
      body: {
        leave_kind: "childcare",
        start_date: "2027-04-01",
        end_date: "2027-09-30",
        note: "育児休業を申し出ます",
      },
    })

    expect(response.status).toBe(201)

    const parsed = familyCareLeaveResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.employee_id).toBe(4)
      expect(parsed.data.note).toBe("育児休業を申し出ます")
    }
  })

  test("returns 409 when overlapping with an existing leave", async () => {
    const response = await request({
      path: "/family-care-leaves",
      token: await applicantToken(),
      method: "POST",
      body: {
        leave_kind: "childcare",
        start_date: "2026-10-01",
        end_date: "2027-03-31",
        note: null,
      },
    })

    expect(response.status).toBe(409)
  })

  test("creates a family care leave with null note", async () => {
    const response = await request({
      path: "/family-care-leaves",
      token: await applicantToken(),
      method: "POST",
      body: {
        leave_kind: "maternity",
        start_date: "2026-07-01",
        end_date: "2026-09-30",
      },
    })

    expect(response.status).toBe(201)

    const parsed = familyCareLeaveResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.note).toBe(null)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/family-care-leaves",
      token: null,
      method: "POST",
      body: {
        leave_kind: "childcare",
        start_date: "2026-10-01",
        end_date: "2027-03-31",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /family-care-leaves/me", () => {
  test("returns only the viewer's family care leaves", async () => {
    const response = await request({
      path: "/family-care-leaves/me",
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(familyCareLeaveResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].employee_id).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/family-care-leaves/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /family-care-leaves/:id", () => {
  test("returns the family care leave for its applicant", async () => {
    const response = await request({
      path: `/family-care-leaves/${ownFamilyCareLeaveId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(200)

    const parsed = familyCareLeaveResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownFamilyCareLeaveId)
    }
  })

  test("returns 403 for another person's family care leave", async () => {
    const response = await request({
      path: `/family-care-leaves/${othersFamilyCareLeaveId}`,
      token: await applicantToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown family care leave", async () => {
    const response = await request({
      path: "/family-care-leaves/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /family-care-leaves/:id", () => {
  test("updates the details of the viewer's family care leave", async () => {
    const response = await request({
      path: `/family-care-leaves/${ownFamilyCareLeaveId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        leave_kind: "family_care",
        start_date: "2026-11-01",
        end_date: "2026-11-30",
        note: "介護のため変更します",
      },
    })

    expect(response.status).toBe(200)

    const parsed = familyCareLeaveResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.leave_kind).toBe("family_care")
      expect(parsed.data.note).toBe("介護のため変更します")
    }
  })

  test("returns 200 when changing only its own period (self-exclusion)", async () => {
    const response = await request({
      path: `/family-care-leaves/${ownFamilyCareLeaveId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        leave_kind: "childcare",
        start_date: "2026-10-15",
        end_date: "2027-02-28",
        note: null,
      },
    })

    expect(response.status).toBe(200)

    const parsed = familyCareLeaveResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.start_date).toBe("2026-10-15")
      expect(parsed.data.end_date).toBe("2027-02-28")
    }
  })

  test("returns 403 when updating another person's family care leave", async () => {
    const response = await request({
      path: `/family-care-leaves/${othersFamilyCareLeaveId}`,
      token: await applicantToken(),
      method: "PUT",
      body: {
        leave_kind: "family_care",
        start_date: "2026-11-01",
        end_date: "2026-11-30",
        note: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown family care leave", async () => {
    const response = await request({
      path: "/family-care-leaves/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "PUT",
      body: {
        leave_kind: "family_care",
        start_date: "2026-11-01",
        end_date: "2026-11-30",
        note: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /family-care-leaves/:id", () => {
  test("cancels the viewer's family care leave and returns 204", async () => {
    const response = await request({
      path: `/family-care-leaves/${ownFamilyCareLeaveId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's family care leave", async () => {
    const response = await request({
      path: `/family-care-leaves/${othersFamilyCareLeaveId}`,
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown family care leave", async () => {
    const response = await request({
      path: "/family-care-leaves/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await applicantToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/family-care-leaves/${ownFamilyCareLeaveId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
