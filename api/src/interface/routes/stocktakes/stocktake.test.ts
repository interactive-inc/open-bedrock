import { describe, expect, test } from "bun:test"
import { seedAssets } from "@/infrastructure/seed/seed-assets"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedStocktakeItems } from "@/infrastructure/seed/seed-stocktake-items"
import { seedStocktakes } from "@/infrastructure/seed/seed-stocktakes"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "stocktake-route-test-secret"

const OPEN_ID = "a1b2c3d4-e5f6-4a1b-8c2d-000000000001"

const CLOSED_ID = "a1b2c3d4-e5f6-4a1b-8c2d-000000000002"

const stocktakeSchema = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  checked_count: z.number(),
  total_count: z.number(),
  items: z.array(
    z.object({
      asset_code: z.string(),
      asset_name: z.string(),
      kind: z.string(),
      checked_at: z.string().nullable(),
      checker_employee_id: z.number().nullable(),
      location_note: z.string().nullable(),
    }),
  ),
})

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
    "assets",
    seedAssets.map((asset) => ({
      code: asset.code,
      name: asset.name,
      kind: asset.kind,
      serial: asset.serial,
      purchased_on: asset.purchasedOn,
      status: asset.status,
      holder_employee_id: asset.holderEmployeeId,
      disposed_on: asset.disposedOn,
      disposal_reason: asset.disposalReason,
    })),
  )

  await seedD1(
    db,
    "stocktakes",
    seedStocktakes.map((stocktake) => ({
      id: stocktake.id,
      name: stocktake.name,
      target_date: stocktake.targetDate,
      status: stocktake.status,
      created_at: stocktake.createdAt,
      closed_at: stocktake.closedAt,
    })),
  )

  await seedD1(
    db,
    "stocktake_items",
    seedStocktakeItems.map((item) => ({
      stocktake_id: item.stocktakeId,
      asset_code: item.assetCode,
      checked_at: item.checkedAt,
      checker_employee_id: item.checkerEmployeeId,
      location_note: item.locationNote,
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
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
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("GET /stocktakes", () => {
  test("lists sessions with counts", async () => {
    const response = await request("/stocktakes", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({
        data: z.array(stocktakeSchema.omit({ items: true })),
        total: z.number(),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
    }
  })

  test("filters by status", async () => {
    const response = await request("/stocktakes?status=open", await memberToken())

    const body = await response.json()

    const parsed = z
      .object({ data: z.array(stocktakeSchema.omit({ items: true })), total: z.number() })
      .safeParse(body)

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("open")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/stocktakes", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /stocktakes", () => {
  test("privileged role starts a session and expands items over non-disposed assets", async () => {
    const response = await request("/stocktakes", await adminToken(), "POST", {
      name: "臨時 棚卸し",
      target_date: "2026-07-08",
    })

    expect(response.status).toBe(201)

    const parsed = stocktakeSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("open")
      // seed の資産は disposed(A0011) を除く in_stock/lent が対象。
      expect(parsed.data.total_count).toBe(5)
      expect(parsed.data.checked_count).toBe(0)
      expect(parsed.data.items.some((item) => item.asset_code === "A0011")).toBe(false)
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/stocktakes", await memberToken(), "POST", {
      name: "臨時 棚卸し",
      target_date: "2026-07-08",
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when target_date is malformed", async () => {
    const response = await request("/stocktakes", await adminToken(), "POST", {
      name: "臨時 棚卸し",
      target_date: "2026/07/08",
    })

    expect(response.status).toBe(400)
  })
})

describe("GET /stocktakes/:id", () => {
  test("returns detail with items", async () => {
    const response = await request(`/stocktakes/${OPEN_ID}`, await memberToken())

    expect(response.status).toBe(200)

    const parsed = stocktakeSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total_count).toBe(5)
      expect(parsed.data.checked_count).toBe(1)
    }
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request(
      "/stocktakes/ffffffff-ffff-4fff-8fff-ffffffffffff",
      await memberToken(),
    )

    expect(response.status).toBe(404)
  })
})

describe("POST /stocktakes/:id/assets/:code/check", () => {
  test("records a check on an open session", async () => {
    const db = await createTestDb()

    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/stocktakes/${OPEN_ID}/assets/A0002/check`,
      token,
      method: "POST",
      body: { location_note: "倉庫B" },
    })

    expect(response.status).toBe(200)

    const detail = await requestWithContext({
      db,
      jwtSecret,
      path: `/stocktakes/${OPEN_ID}`,
      token,
    })

    const parsed = stocktakeSchema.safeParse(await detail.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const item = parsed.data.items.find((row) => row.asset_code === "A0002")

      expect(item?.checked_at).not.toBe(null)
      expect(item?.location_note).toBe("倉庫B")
    }
  })

  test("returns 409 when the session is closed", async () => {
    const response = await request(
      `/stocktakes/${CLOSED_ID}/assets/A0001/check`,
      await adminToken(),
      "POST",
      {},
    )

    expect(response.status).toBe(409)
  })

  test("returns 404 for an asset not in the session", async () => {
    const response = await request(
      `/stocktakes/${OPEN_ID}/assets/A9999/check`,
      await adminToken(),
      "POST",
      {},
    )

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request(
      `/stocktakes/${OPEN_ID}/assets/A0002/check`,
      await memberToken(),
      "POST",
      {},
    )

    expect(response.status).toBe(403)
  })
})

describe("POST /stocktakes/:id/close", () => {
  test("closes an open session", async () => {
    const response = await request(`/stocktakes/${OPEN_ID}/close`, await adminToken(), "POST", {})

    expect(response.status).toBe(200)

    const parsed = stocktakeSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("closed")
      expect(parsed.data.closed_at).not.toBe(null)
    }
  })

  test("returns 409 when already closed", async () => {
    const response = await request(`/stocktakes/${CLOSED_ID}/close`, await adminToken(), "POST", {})

    expect(response.status).toBe(409)
  })

  test("member is forbidden", async () => {
    const response = await request(`/stocktakes/${OPEN_ID}/close`, await memberToken(), "POST", {})

    expect(response.status).toBe(403)
  })
})
