import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { seedCertificateRequests } from "@/contexts/certificate-request/infrastructure/seed/seed-certificate-requests"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { databaseMiddleware } from "@/api/database-middleware"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import * as createRoute from "@/contexts/certificate-request/interface/routes/certificate-requests"
import * as detailRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.$id"
import * as meRoute from "@/contexts/certificate-request/interface/routes/certificate-requests.me"
import { z } from "zod"

/**
 * app.ts は統合者が後で配線するため、ここでは同じミドルウェア連鎖の使い捨て app に
 * certificate-request のハンドラだけを載せて検証する。me は :id より前に並べる。
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
  .post("/certificate-requests", ...createRoute.POST)
  .get("/certificate-requests/me", ...meRoute.GET)
  .get("/certificate-requests/:id", ...detailRoute.GET)
  .put("/certificate-requests/:id", ...detailRoute.PUT)
  .delete("/certificate-requests/:id", ...detailRoute.DELETE)

const certificateRequestResponseSchema = z.object({
  id: z.string(),
  requester_id: z.number(),
  certificate_type: z.string(),
  submit_to: z.string().nullable(),
  needed_by: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "certificate-requests-crud-test-secret"

const ownCertificateRequestId = "20000000-0000-0000-0000-000000000002"

const othersCertificateRequestId = "20000000-0000-0000-0000-000000000001"

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
    "certificate_requests",
    seedCertificateRequests.map((certificateRequest) => ({
      id: certificateRequest.id,
      requester_id: certificateRequest.requesterId,
      certificate_type: certificateRequest.certificateType,
      submit_to: certificateRequest.submitTo,
      needed_by: certificateRequest.neededBy,
      note: certificateRequest.note,
      status: certificateRequest.status,
      created_at: certificateRequest.createdAt,
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
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

describe("POST /certificate-requests", () => {
  test("creates a certificate request with status requested", async () => {
    const response = await request({
      path: "/certificate-requests",
      token: await requesterToken(),
      method: "POST",
      body: {
        certificate_type: "employment",
        submit_to: "City Hall",
        needed_by: "2026-08-01",
        note: "For loan screening",
      },
    })

    expect(response.status).toBe(201)

    const parsed = certificateRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.requester_id).toBe(4)
      expect(parsed.data.certificate_type).toBe("employment")
    }
  })

  test("creates a certificate request with null optional fields", async () => {
    const response = await request({
      path: "/certificate-requests",
      token: await requesterToken(),
      method: "POST",
      body: {
        certificate_type: "income",
      },
    })

    expect(response.status).toBe(201)

    const parsed = certificateRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.submit_to).toBe(null)
      expect(parsed.data.needed_by).toBe(null)
      expect(parsed.data.note).toBe(null)
    }
  })

  test("rejects a non-ISO or impossible needed_by with 400", async () => {
    for (const neededBy of ["whenever", "2026/08/01", "2026-02-30"]) {
      const response = await request({
        path: "/certificate-requests",
        token: await requesterToken(),
        method: "POST",
        body: {
          certificate_type: "employment",
          needed_by: neededBy,
        },
      })

      expect(response.status).toBe(400)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/certificate-requests",
      token: null,
      method: "POST",
      body: {
        certificate_type: "employment",
      },
    })

    expect(response.status).toBe(401)
  })
})

describe("GET /certificate-requests/me", () => {
  test("returns only the viewer's certificate requests", async () => {
    const response = await request({
      path: "/certificate-requests/me",
      token: await requesterToken(),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(certificateRequestResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].requester_id).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/certificate-requests/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /certificate-requests/:id", () => {
  test("returns the certificate request for its requester", async () => {
    const response = await request({
      path: `/certificate-requests/${ownCertificateRequestId}`,
      token: await requesterToken(),
    })

    expect(response.status).toBe(200)

    const parsed = certificateRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownCertificateRequestId)
    }
  })

  test("returns 403 for another person's certificate request", async () => {
    const response = await request({
      path: `/certificate-requests/${othersCertificateRequestId}`,
      token: await requesterToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown certificate request", async () => {
    const response = await request({
      path: "/certificate-requests/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /certificate-requests/:id", () => {
  test("updates the details of the viewer's certificate request", async () => {
    const response = await request({
      path: `/certificate-requests/${ownCertificateRequestId}`,
      token: await requesterToken(),
      method: "PUT",
      body: {
        certificate_type: "retirement",
        submit_to: "Pension Office",
        needed_by: "2026-09-01",
        note: "Revised purpose",
      },
    })

    expect(response.status).toBe(200)

    const parsed = certificateRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.certificate_type).toBe("retirement")
      expect(parsed.data.submit_to).toBe("Pension Office")
    }
  })

  test("returns 403 when updating another person's certificate request", async () => {
    const response = await request({
      path: `/certificate-requests/${othersCertificateRequestId}`,
      token: await requesterToken(),
      method: "PUT",
      body: {
        certificate_type: "retirement",
        submit_to: null,
        needed_by: null,
        note: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown certificate request", async () => {
    const response = await request({
      path: "/certificate-requests/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
      method: "PUT",
      body: {
        certificate_type: "retirement",
        submit_to: null,
        needed_by: null,
        note: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /certificate-requests/:id", () => {
  test("cancels the viewer's certificate request and returns 204", async () => {
    const response = await request({
      path: `/certificate-requests/${ownCertificateRequestId}`,
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's certificate request", async () => {
    const response = await request({
      path: `/certificate-requests/${othersCertificateRequestId}`,
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown certificate request", async () => {
    const response = await request({
      path: "/certificate-requests/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await requesterToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/certificate-requests/${ownCertificateRequestId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
