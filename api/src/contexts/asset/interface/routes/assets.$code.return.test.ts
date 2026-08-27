import { describe, expect, test } from "bun:test"
import { seedAssetLendings } from "@/contexts/asset/test/seed/seed-asset-lendings.test-support"
import { seedAssets } from "@/contexts/asset/test/seed/seed-assets.test-support"
import { seedEmployees } from "@/api/test/support/company/seed-employees.test-support"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const jwtSecret = "asset-return-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
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

describe("POST /assets/:code/return", () => {
  test("privileged role returns a lent asset and returns 200", async () => {
    const response = await request("/assets/A0001/return", await adminToken(), "POST")

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("in_stock")
      expect(parsed.data.holder_employee_id).toBeNull()
    }
  })

  test("returns 409 when the asset is not lent", async () => {
    const response = await request("/assets/A0003/return", await adminToken(), "POST")

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/assets/A9999/return", await adminToken(), "POST")

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request("/assets/A0001/return", await memberToken(), "POST")

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/assets/A0001/return", null, "POST")

    expect(response.status).toBe(401)
  })
})
