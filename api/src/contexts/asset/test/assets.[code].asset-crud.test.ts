import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { contextStorage } from "hono/context-storage"
import { HTTPException } from "hono/http-exception"
import { DELETE, PUT } from "@/contexts/asset/interface/routes/assets.$code"
import { databaseMiddleware } from "@/api/database-middleware"
import type { Bindings } from "@/env"
import { factory } from "@/api/http/factory"
import { seedAssetLendings } from "@/contexts/asset/test/seed/seed-asset-lendings.test-support"
import { seedAssets } from "@/contexts/asset/test/seed/seed-assets.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "asset-crud-route-test-secret"

const assetResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: zEmployeeId.nullable(),
})

/** app.ts と同じ登録（:code）でハンドラを載せたローカル app。app.ts は他エージェントと共有のため触れない。 */
const localApp = factory
  .createApp()
  .use("*", contextStorage())
  .use("*", databaseMiddleware)
  .onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status)
    }

    return c.json({ error: "internal server error" }, 500)
  })
  .put("/asset/assets/:code", ...PUT)
  .delete("/asset/assets/:code", ...DELETE)

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
  token: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }

  if (body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: await createTestDb(),
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    NOW: "2026-01-01T00:00:00.000Z",
  }

  return localApp.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    bindings,
  )
}

describe("PUT /assets/:code", () => {
  test("privileged role updates asset details and returns 200", async () => {
    const response = await request("/asset/assets/A0003", await adminToken(), "PUT", {
      name: "Updated Notebook",
      kind: "monitor",
      serial: "SN-NEW",
      purchased_on: "2026-01-01",
    })

    expect(response.status).toBe(200)

    const parsed = assetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Updated Notebook")
      expect(parsed.data.kind).toBe("monitor")
      expect(parsed.data.serial).toBe("SN-NEW")
      expect(parsed.data.status).toBe("in_stock")
    }
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request("/asset/assets/A0003", await memberToken(), "PUT", {
      name: "Hijacked",
      kind: "pc",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/asset/assets/A9999", await adminToken(), "PUT", {
      name: "Ghost",
      kind: "pc",
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /assets/:code", () => {
  test("privileged role deletes an in_stock asset and returns 204", async () => {
    const response = await request("/asset/assets/A0003", await adminToken(), "DELETE")

    expect(response.status).toBe(204)
  })

  test("returns 409 when the asset is currently lent", async () => {
    const response = await request("/asset/assets/A0001", await adminToken(), "DELETE")

    expect(response.status).toBe(409)
  })

  test("returns 403 for a non-privileged role", async () => {
    const response = await request("/asset/assets/A0003", await memberToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing asset", async () => {
    const response = await request("/asset/assets/A9999", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })
})
