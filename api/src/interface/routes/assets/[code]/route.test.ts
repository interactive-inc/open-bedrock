import { describe, expect, test } from "bun:test"
import { seedAssetLendings } from "@/infrastructure/seed/seed-asset-lendings"
import { seedAssets } from "@/infrastructure/seed/seed-assets"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "asset-detail-route-test-secret"

const assetResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: z.number().nullable(),
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
    })),
  )

  await seedD1(
    db,
    "asset_lendings",
    seedAssetLendings.map((lending) => ({
      id: lending.id,
      asset_code: lending.assetCode,
      employee_id: lending.employeeId,
      lent_at: lending.lentAt,
      returned_at: lending.returnedAt,
    })),
  )

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: employeeId === 1 ? "admin" : "member",
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method,
    body,
  })
}

describe("GET /assets/:code", () => {
  test("current holder reads their asset sensitive fields", async () => {
    const response = await request("/assets/A0001", await memberToken())

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("A0001")
      expect(parsed.data.serial).toBe("PF-X1-0001")
      expect(parsed.data.purchased_on).toBe("2024-04-01")
      expect(parsed.data.holder_employee_id).toBe(5)
    }
  })

  test("asset:manage holder reads another employee asset sensitive fields", async () => {
    const response = await request("/assets/A0002", await tokenFor(1))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      serial: "CN-D27-0002",
      purchased_on: "2024-04-01",
      holder_employee_id: 9,
    })
  })

  test("unrelated member receives only catalog fields", async () => {
    const response = await request("/assets/A0001", await tokenFor(6))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      code: "A0001",
      name: "Standard Laptop 14",
      kind: "pc",
      status: "lent",
      serial: null,
      purchased_on: null,
      holder_employee_id: null,
    })
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/assets/A9999", await memberToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets/A0001", null)

    expect(response.status).toBe(401)
  })
})
