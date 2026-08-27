import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedAssetLendings } from "@/contexts/asset/test/seed/seed-asset-lendings.test-support"
import { seedAssets } from "@/contexts/asset/test/seed/seed-assets.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "asset-dispose-route-test-secret"

const assetResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: zEmployeeId.nullable(),
  disposed_on: z.string().nullable(),
  disposal_reason: z.string().nullable(),
})

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
    employeeId: toWorkforceEmployeeId(1),
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(5),
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

describe("POST /assets/:code/dispose", () => {
  test("privileged role disposes an in_stock asset and returns 200", async () => {
    const response = await request("/asset/assets/A0003/dispose", await adminToken(), "POST", {
      reason: "故障のため廃棄",
      disposed_on: "2026-07-01",
    })

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("disposed")
      expect(parsed.data.holder_employee_id).toBe(null)
      expect(parsed.data.disposed_on).toBe("2026-07-01")
      expect(parsed.data.disposal_reason).toBe("故障のため廃棄")
    }
  })

  test("returns 409 when the asset is lent", async () => {
    const response = await request("/asset/assets/A0001/dispose", await adminToken(), "POST", {
      reason: "廃棄",
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the asset is already disposed", async () => {
    const response = await request("/asset/assets/A0011/dispose", await adminToken(), "POST", {
      reason: "廃棄",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown asset", async () => {
    const response = await request("/asset/assets/A9999/dispose", await adminToken(), "POST", {
      reason: "廃棄",
    })

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request("/asset/assets/A0003/dispose", await memberToken(), "POST", {
      reason: "廃棄",
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when reason is missing", async () => {
    const response = await request("/asset/assets/A0003/dispose", await adminToken(), "POST", {})

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/asset/assets/A0003/dispose", null, "POST", {
      reason: "廃棄",
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /assets/:code/lend after dispose", () => {
  test("returns 409 when trying to lend a disposed asset", async () => {
    const response = await request("/asset/assets/A0011/lend", await adminToken(), "POST", {
      employee_code: "E005",
    })

    expect(response.status).toBe(409)
  })
})
