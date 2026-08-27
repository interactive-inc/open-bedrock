import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "certification-route-test-secret"

/** E001=admin(certification:manage / read:all), E005=member(権限なし)。 */
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await initializeStandardCompanyTestState(db)

  await seedD1(db, "certification_definitions", [
    {
      id: 1,
      code: "FE",
      name: "基本情報技術者",
      issuer: "IPA",
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /certification-definitions", () => {
  test("returns 200 for any authenticated member", async () => {
    const response = await request({ path: "/certification-definitions", token: await tokenFor(5) })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(z.unknown()), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/certification-definitions", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /certification-definitions", () => {
  test("creates a certification for a manager (certification:manage)", async () => {
    const response = await request({
      path: "/certification-definitions",
      token: await tokenFor(1),
      method: "POST",
      body: { code: "AP", name: "応用情報技術者", issuer: "IPA" },
    })

    expect(response.status).toBe(201)

    const parsed = z.object({ code: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("AP")
    }
  })

  test("returns 403 for a member without certification:manage", async () => {
    const response = await request({
      path: "/certification-definitions",
      token: await tokenFor(5),
      method: "POST",
      body: { code: "AP", name: "応用情報技術者" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 on duplicate code", async () => {
    const response = await request({
      path: "/certification-definitions",
      token: await tokenFor(1),
      method: "POST",
      body: { code: "FE", name: "基本情報技術者" },
    })

    expect(response.status).toBe(409)
  })
})
